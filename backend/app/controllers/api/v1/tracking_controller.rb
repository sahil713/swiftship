module Api
  module V1
    class TrackingController < ApplicationController
      def show
        booking = Booking.includes(:service, :status_events, :proof_of_delivery)
                         .find_by!(tracking_number: params[:tracking_number].to_s.strip.upcase)
        render json: booking.tracking_json
      end
    end
  end
end
