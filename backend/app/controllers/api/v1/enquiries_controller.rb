module Api
  module V1
    class EnquiriesController < ApplicationController
      def create
        attrs = params.require(:enquiry).permit(:name, :email, :phone, :subject, :message)
        enquiry = Enquiry.new(attrs)
        enquiry.booking = Booking.find_by(reference: params.dig(:enquiry, :booking_reference).to_s.strip.upcase) if params.dig(:enquiry, :booking_reference).present?
        enquiry.save!
        render json: { ok: true, id: enquiry.id }, status: :created
      end
    end
  end
end
