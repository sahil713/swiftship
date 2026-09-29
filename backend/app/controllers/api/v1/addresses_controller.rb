module Api
  module V1
    class AddressesController < ApplicationController
      before_action :authenticate!

      def index = render(json: current_user.addresses.order(:label, :id))

      def create
        render json: current_user.addresses.create!(address_params), status: :created
      end

      def update
        address = current_user.addresses.find(params[:id])
        address.update!(address_params)
        render json: address
      end

      def destroy
        current_user.addresses.find(params[:id]).destroy!
        head :no_content
      end

      private

      def address_params = params.require(:address).permit(:label, :contact_name, :phone, :line1, :line2, :city, :postcode)
    end
  end
end
