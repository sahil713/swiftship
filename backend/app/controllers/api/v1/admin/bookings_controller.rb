module Api
  module V1
    module Admin
      class BookingsController < BaseController
        before_action :load_booking, except: %i[index create]
        before_action :admin_only!, only: :refund

        EDITABLE = %i[
          collection_contact_name collection_phone collection_email collection_line1 collection_line2
          collection_city collection_postcode delivery_contact_name delivery_phone delivery_email
          delivery_line1 delivery_line2 delivery_city delivery_postcode item_description quantity
          weight_kg length_cm width_cm height_cm fragile collection_date collection_instructions
          delivery_instructions special_requirements estimated_delivery_date service_id
        ].freeze

        def index
          scope = Booking.includes(:service, :driver, :user).search(params[:q]).order(created_at: :desc)
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(service_id: params[:service_id]) if params[:service_id].present?
          scope = scope.where(driver_id: params[:driver_id]) if params[:driver_id].present?
          scope = scope.where(payment_status: params[:payment_status]) if params[:payment_status].present?
          scope = scope.where(area_review: true) if params[:area_review] == "1"
          scope = scope.where(collection_date: params[:from]..) if params[:from].present?
          scope = scope.where(collection_date: ..params[:to]) if params[:to].present?
          bookings, meta = paginate(scope)
          render json: { bookings: bookings.map(&:summary_json), meta: }
        end

        def show = render_booking

        NEW_BOOKING_FIELDS = (EDITABLE + %i[collection_time]).freeze

        # Office creates a booking (e.g. taken over the phone). Postcodes go through the same
        # service-area rules as the website; Ireland is refused, restricted areas are flagged.
        def create
          attrs = params.require(:booking).permit(*NEW_BOOKING_FIELDS, :customer_name, :customer_email, :customer_phone,
                                                  :special_requirements, :status, :payment_status, :agreed_price)
          collection = ServiceArea.check(attrs[:collection_postcode])
          delivery = ServiceArea.check(attrs[:delivery_postcode])
          errors = []
          errors << "Collection: #{collection.message}" unless collection.ok
          errors << "Delivery: #{delivery.message}" unless delivery.ok
          return render(json: { error: errors.to_sentence }, status: :unprocessable_entity) if errors.any?

          email = attrs[:customer_email].to_s.strip.downcase
          booking = Booking.new(attrs.except(:customer_name, :customer_email, :customer_phone, :status, :payment_status, :agreed_price))
          booking.customer_email = email
          booking.user = User.find_by("lower(email) = ?", email) if email.present?
          # Contact details default to the customer's when left blank.
          { "collection_contact_name" => :customer_name, "collection_email" => :customer_email, "collection_phone" => :customer_phone }.each do |field, src|
            booking[field] = attrs[src] if booking[field].blank?
          end
          booking.collection_postcode = collection.postcode
          booking.delivery_postcode = delivery.postcode
          booking.apply_area_review(collection:, delivery:)
          pence = attrs[:agreed_price].present? ? (BigDecimal(attrs[:agreed_price].to_s) * 100).round : nil
          if pence
            booking.confirmed_price_pence = pence
            booking.price_confirmed_at = Time.current
          end

          Booking.transaction do
            booking.save!
            booking.status_events.create!(status: "quote_requested", user: current_user, note: "Booking created by the office", customer_visible: false)
            booking.transition_to!("booked", user: current_user, note: "Booking confirmed") if attrs[:status] == "booked"
            booking.set_payment_status!(attrs[:payment_status], user: current_user, reason: "Set when the booking was created") if attrs[:payment_status].present?
            booking.notes.create!(user: current_user, kind: "internal", body: "Service area review needed:\n#{booking.area_review_notes}") if booking.area_review
          end
          @booking = booking
          render_booking(status: :created)
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # Manual payment status change (kept in the change history).
        def payment_status
          @booking.set_payment_status!(params.require(:payment_status), user: current_user, reason: params[:reason])
          @booking.notes.create!(user: current_user, kind: "internal",
                                 body: "Payment status set to #{Booking::PAYMENT_STATUS_LABELS[@booking.payment_status]}#{params[:reason].present? ? " – #{params[:reason]}" : ''}")
          render_booking
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # Sends a saved payment method's details to the customer by email and/or text.
        def send_payment_details
          method = PaymentMethod.active.find(params.require(:payment_method_id))
          channels = Array(params[:channels]) & %w[email sms]
          return render(json: { error: "Choose email and/or text" }, status: :unprocessable_entity) if channels.empty?
          amount = params[:amount].present? ? (BigDecimal(params[:amount].to_s) * 100).round : @booking.confirmed_price_pence
          details = method.detail_lines(reference: @booking.reference).map { |l, v| "#{l}: #{v}" }.join(", ")
          sms_text = ["Shift Logistics – booking #{@booking.reference}.", (amount ? "Amount due #{Money.format(amount)}." : nil),
                      "Pay to: #{details}.", method.instructions.presence, params[:message].presence].compact.join(" ")
          results = CustomerMessenger.deliver(
            @booking, channels:, email_to: @booking.customer_email, phone_to: @booking.collection_phone,
            subject: "Payment details for booking #{@booking.reference}", sms_text:,
            email: ->(to) { CustomerMailer.payment_details(@booking, method, to:, amount_pence: amount, message: params[:message]) }
          )
          @booking.notes.create!(user: current_user, kind: "internal",
                                 body: "Payment details (#{method.name}) sent – #{results.map { |r| "#{r.channel == 'sms' ? 'text' : 'email'} to #{r.recipient}: #{r.status.tr('_', ' ')}" }.join('; ')}")
          render json: { results: results.map(&:as_json), booking: @booking.reload.detail_json(staff: true) }
        rescue ArgumentError
          render json: { error: "Enter a valid amount" }, status: :unprocessable_entity
        end

        def update
          @booking.assign_attributes(params.require(:booking).permit(*EDITABLE))
          changes = @booking.changes_to_save.except("updated_at").transform_values { |(old, new)| [old&.to_s, new&.to_s] }
          @booking.save!
          AuditLog.record!(@booking, user: current_user, action: "booking_edited", changes:, reason: params[:reason])
          @booking.notes.create!(user: current_user, kind: "internal",
                                 body: "Booking details edited: #{changes.map { |f, (o, n)| "#{f.humanize} #{o.presence || '—'} → #{n.presence || '—'}" }.join('; ')}") if changes.any?
          render_booking
        end

        def status
          @booking.transition_to!(params.require(:status), user: current_user, note: params[:note].presence,
                                  location: params[:location].presence,
                                  customer_visible: params.fetch(:customer_visible, true).to_s != "false")
          render_booking
        end

        def confirm_price
          pence = Integer(params.require(:price_pence), exception: false)
          return render(json: { error: "Enter a valid price" }, status: :unprocessable_entity) unless pence&.positive?
          unless %w[quote_requested awaiting_payment].include?(@booking.status) && @booking.payment_status == "unpaid"
            return render json: { error: "The price can only be changed before payment" }, status: :unprocessable_entity
          end
          @booking.confirm_price!(pence, user: current_user, note: params[:note].presence)
          render_booking
        end

        def reprice
          quote = PriceCalculator.new(service: @booking.service, **@booking.attributes.symbolize_keys.slice(
            :collection_postcode, :delivery_postcode, :quantity, :weight_kg, :length_cm, :width_cm, :height_cm, :fragile, :collection_date
          ).merge(collection_date: nil)).call
          render json: quote
        end

        # Assigns the collection or delivery task to a driver, or reassigns it while still open.
        def assign_task
          kind = params.require(:kind)
          return render(json: { error: "Unknown task type" }, status: :unprocessable_entity) unless DriverTask::KINDS.include?(kind)
          driver = User.drivers.find(params.require(:driver_id))
          task = { "collection" => @booking.collection_task, "delivery" => @booking.delivery_task, "direct" => @booking.direct_task }[kind]

          if task
            return render_booking if task.driver_id == driver.id
            task.assign_to!(driver, by: current_user)
          else
            error = @booking.task_creation_error(kind)
            return render json: { error: }, status: :unprocessable_entity if error
            task = @booking.driver_tasks.create!(kind:, driver:)
            task.events.create!(action: "assigned", user: current_user, note: driver.name, occurred_at: Time.current)
            @booking.sync_driver!
          end
          message = "#{kind == 'direct' ? 'Direct collection & delivery' : kind.capitalize} task assigned to #{driver.name}"
          @booking.notes.create!(user: current_user, kind: "internal", body: message)
          render_booking
        rescue DriverTask::InvalidStep => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def unassign_task
          task = @booking.driver_tasks.find(params[:task_id])
          previous = task.driver&.name
          task.unassign!(by: current_user)
          @booking.notes.create!(user: current_user, kind: "internal", body: "#{task.kind.capitalize} task removed from #{previous}")
          render_booking
        rescue DriverTask::InvalidStep => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def add_note
          @booking.notes.create!(user: current_user, kind: params.fetch(:kind, "internal"), body: params.require(:body))
          render_booking
        end

        def refund
          payment = @booking.payments.find(params.require(:payment_id))
          amount = Integer(params.require(:amount_pence), exception: false)
          unless amount&.positive? && amount <= payment.refundable_pence
            return render json: { error: "Refund must be between £0.01 and #{Money.format(payment.refundable_pence)}" }, status: :unprocessable_entity
          end
          PaymentProcessor.refund!(payment:, amount_pence: amount)
          remaining = @booking.paid_pence
          @booking.update!(payment_status: remaining.zero? ? "refunded" : "partially_refunded")
          @booking.notes.create!(user: current_user, kind: "internal",
                                 body: "Refunded #{Money.format(amount)}#{params[:reason].present? ? " – #{params[:reason]}" : ''}")
          render_booking
        end

        def resolve_change_request
          request = @booking.change_requests.find(params[:change_request_id])
          decision = params.require(:decision)
          return render(json: { error: "Invalid decision" }, status: :unprocessable_entity) unless %w[approved rejected].include?(decision)
          ChangeRequest.transaction do
            request.update!(status: decision, admin_response: params[:response])
            if decision == "approved" && request.kind == "cancellation" && @booking.status != "cancelled"
              @booking.transition_to!("cancelled", user: current_user, note: params[:response].presence || "Cancellation approved", force: true)
            end
          end
          render_booking
        end

        private

        def load_booking = @booking = Booking.find_by!(reference: params[:reference])

        def render_booking(status: :ok)
          render status:, json: { booking: @booking.reload.detail_json(staff: true), drivers: User.drivers.order(:name).map { _1.slice(:id, :name) } }
        end
      end
    end
  end
end
