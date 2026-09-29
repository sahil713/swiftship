module Api
  module V1
    class QuotesController < ApplicationController
      def create
        service = Service.active.find_by(id: params[:service_id])
        result = PriceCalculator.new(service:, **QuotesController.calc_args(params)).call
        render json: result
      end

      def self.calc_args(params)
        {
          collection_postcode: params[:collection_postcode],
          delivery_postcode: params[:delivery_postcode],
          quantity: params[:quantity],
          weight_kg: params[:weight_kg],
          length_cm: params[:length_cm],
          width_cm: params[:width_cm],
          height_cm: params[:height_cm],
          fragile: params[:fragile],
          collection_date: params[:collection_date]
        }
      end
    end
  end
end
