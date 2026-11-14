module Api
  module V1
    class TrackingController < ApplicationController
      # Accepts either the tracking number (SSUK…) or the booking reference (SS-YYMM-XXXXXX),
      # since customers see the reference more often (emails, payment reference).
      def show
        code = params[:tracking_number].to_s.upcase.gsub(/[‐-―−]/, "-").gsub(/\s+/, "")
        booking = Booking.includes(:service, :status_events, :proof_of_delivery)
                         .where(tracking_number: code).or(Booking.where(reference: code)).first!
        render json: booking.tracking_json
      end
    end
  end
end
