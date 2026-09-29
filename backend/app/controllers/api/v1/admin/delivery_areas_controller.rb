module Api
  module V1
    module Admin
      class DeliveryAreasController < BaseController
        before_action :admin_only!, except: :index

        def index = render(json: DeliveryArea.order(:zone, :name))

        def create
          render json: DeliveryArea.create!(record_params), status: :created
        end

        def update
          record = DeliveryArea.find(params[:id])
          record.update!(record_params)
          render json: record
        end

        def destroy
          record = DeliveryArea.find(params[:id])
          return render_errors(record) unless record.destroy
          head :no_content
        end

        private

        def record_params = params.require(:delivery_area).permit(:name, :zone, :surcharge_pence, :extra_transit_days, :serviced, :notes, postcode_areas: [])
      end
    end
  end
end
