module Api
  module V1
    module Admin
      class BookingsController < BaseController
        before_action :load_booking, except: :index
        before_action :admin_only!, only: :refund

        EDITABLE = %i[
          collection_contact_name collection_phone collection_email collection_line1 collection_line2
          collection_city collection_postcode delivery_contact_name delivery_phone delivery_email
          delivery_line1 delivery_line2 delivery_city delivery_postcode item_description quantity
          weight_kg length_cm width_cm height_cm fragile collection_date collection_instructions
          delivery_instructions special_requirements estimated_delivery_date service_id
        ].freeze

        def index
          scope = Booking.includes(:service, :driver).search(params[:q]).order(created_at: :desc)
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

        def update
          @booking.update!(params.require(:booking).permit(*EDITABLE))
          @booking.notes.create!(user: current_user, body: "Booking details edited", kind: "internal")
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
            error = task_creation_error(kind)
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

        # Why a new task of this kind can't be created yet (nil when it can).
        def task_creation_error(kind)
          case kind
          when "collection", "direct"
            return "Confirm the booking (status Booked) before assigning the collection." unless @booking.status == "booked"
            other = kind == "collection" ? @booking.direct_task : @booking.collection_task
            "This job already has a #{other.kind == 'direct' ? 'direct collection & delivery' : 'collection'} task." if other
          when "delivery"
            return "This job is handled as a direct collection & delivery." if @booking.direct_task
            "Delivery tasks can be assigned once the items are at the depot." unless %w[in_warehouse in_transit failed_delivery].include?(@booking.status)
          end
        end

        def load_booking = @booking = Booking.find_by!(reference: params[:reference])

        def render_booking
          render json: { booking: @booking.reload.detail_json(staff: true), drivers: User.drivers.order(:name).map { _1.slice(:id, :name) } }
        end
      end
    end
  end
end
