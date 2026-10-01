module Api
  module V1
    # Customer-facing bookings. Signed-in customers see their own bookings;
    # guests access a booking with the reference plus its private guest token.
    class BookingsController < ApplicationController
      before_action :authenticate!, only: :index
      before_action :load_booking, except: %i[index create]

      BOOKING_FIELDS = %i[
        service_id collection_contact_name collection_phone collection_email collection_line1
        collection_line2 collection_city collection_postcode delivery_contact_name delivery_phone
        delivery_email delivery_line1 delivery_line2 delivery_city delivery_postcode
        item_description quantity weight_kg length_cm width_cm height_cm fragile
        collection_date collection_instructions delivery_instructions special_requirements
      ].freeze

      def index
        scope = current_user.bookings.includes(:service, :driver).order(created_at: :desc)
        scope = scope.where(status: Booking::ACTIVE_JOB_STATUSES + %w[quote_requested awaiting_payment]) if params[:filter] == "current"
        scope = scope.where(status: %w[delivered cancelled]) if params[:filter] == "past"
        bookings, meta = paginate(scope)
        render json: { bookings: bookings.map(&:summary_json), meta: }
      end

      def create
        attrs = params.require(:booking).permit(*BOOKING_FIELDS)
        return create_enquiry(attrs) unless Setting.get(:pricing_enabled)

        service = Service.active.find_by(id: attrs[:service_id])
        quote = PriceCalculator.new(service:, **QuotesController.calc_args(attrs)).call
        unless quote.ok
          return render json: { error: quote.errors.to_sentence, quote: }, status: :unprocessable_entity
        end

        booking = Booking.new(attrs)
        booking.user = current_user if current_user&.role == "customer"
        booking.customer_email = current_user&.email || attrs[:collection_email]
        booking.collection_postcode = quote.collection.postcode
        booking.delivery_postcode = quote.delivery.postcode
        booking.estimated_price_pence = quote.total_pence
        booking.estimated_delivery_date = quote.estimated_delivery_date
        booking.price_breakdown = { lines: quote.lines, warnings: quote.warnings, chargeable_weight_kg: quote.chargeable_weight_kg }

        Booking.transaction do
          booking.save!
          booking.status_events.create!(status: "quote_requested", note: "Quote request received")
        end

        # Complete requests with a known weight are priced automatically; others wait for staff review.
        if Setting.get(:auto_confirm_quotes) && !quote.needs_review && booking.weight_kg.present?
          booking.confirm_price!(quote.total_pence, note: "Price confirmed automatically")
        else
          BookingNotifier.status_changed(booking)
        end

        render json: { booking: booking.detail_json, guest_token: booking.guest_token }, status: :created
      end

      def show
        render json: { booking: @booking.detail_json }
      end

      def pay
        unless @booking.payable?
          return render json: { error: "This booking isn't ready for payment" }, status: :unprocessable_entity
        end
        payment = PaymentProcessor.charge!(
          booking: @booking, amount_pence: @booking.confirmed_price_pence,
          card_number: params[:card_number], expiry: params[:expiry], cvc: params[:cvc]
        )
        @booking.update!(payment_status: "paid")
        @booking.transition_to!("booked", note: "Payment received – #{payment.card_brand} ending #{payment.card_last4}")
        render json: { booking: @booking.reload.detail_json }
      rescue PaymentProcessor::Declined => e
        render json: { error: e.message }, status: :payment_required
      end

      def change_request
        kind = params[:kind].to_s
        if kind == "cancellation" && !@booking.cancellable_by_customer?
          return render json: { error: "This booking can no longer be cancelled online. Please contact us." }, status: :unprocessable_entity
        end
        if @booking.change_requests.pending.exists?(kind:)
          return render json: { error: "You already have a pending #{kind} request for this booking." }, status: :unprocessable_entity
        end

        # Unpaid bookings can be cancelled straight away; paid ones need staff to handle the refund.
        if kind == "cancellation" && @booking.payment_status == "unpaid"
          @booking.change_requests.create!(kind:, details: params[:details], user: current_user, status: "approved",
                                           admin_response: "Cancelled automatically – no payment had been taken.")
          @booking.transition_to!("cancelled", note: "Cancelled by customer", force: true)
        else
          @booking.change_requests.create!(kind:, details: params[:details], user: current_user)
        end
        render json: { booking: @booking.reload.detail_json }, status: :created
      end

      private

      # Phase 1 flow: save the request without any price and email the full details to the
      # admin team, who call the customer to agree a price.
      def create_enquiry(attrs)
        collection = ServiceArea.check(attrs[:collection_postcode])
        delivery = ServiceArea.check(attrs[:delivery_postcode])
        errors = []
        errors << "Collection: #{collection.message}" unless collection.ok
        errors << "Delivery: #{delivery.message}" unless delivery.ok
        errors << "Choose a service." unless Service.active.exists?(id: attrs[:service_id])
        return render(json: { error: errors.to_sentence }, status: :unprocessable_entity) if errors.any?

        booking = Booking.new(attrs)
        booking.user = current_user if current_user&.role == "customer"
        booking.customer_email = current_user&.email || attrs[:collection_email]
        booking.collection_postcode = collection.postcode
        booking.delivery_postcode = delivery.postcode

        Booking.transaction do
          booking.save!
          booking.status_events.create!(status: "quote_requested", note: "Quote request received – our team will call to discuss pricing")
        end
        EnquiryNotifier.new_request(booking)

        render json: { booking: booking.detail_json, guest_token: booking.guest_token }, status: :created
      end

      def load_booking
        @booking = Booking.includes(:service, :status_events, :payments, :change_requests).find_by!(reference: params[:reference])
        owner = current_user && (@booking.user_id == current_user.id || current_user.staff?)
        guest = params[:token].present? && ActiveSupport::SecurityUtils.secure_compare(params[:token].to_s, @booking.guest_token)
        raise ActiveRecord::RecordNotFound unless owner || guest
      end
    end
  end
end
