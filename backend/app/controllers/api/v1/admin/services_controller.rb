module Api
  module V1
    module Admin
      class ServicesController < BaseController
        before_action :admin_only!, except: :index

        def index = render(json: Service.order(:position, :id))

        def create
          render json: Service.create!(record_params), status: :created
        end

        def update
          record = Service.find(params[:id])
          record.update!(record_params)
          render json: record
        end

        def destroy
          record = Service.find(params[:id])
          return render_errors(record) unless record.destroy
          head :no_content
        end

        private

        def record_params = params.require(:service).permit(:name, :slug, :tagline, :description, :transit_time, :base_price_pence, :price_per_kg_pence, :included_kg, :max_weight_kg, :cutoff_hour, :restrictions, :position, :active)
      end
    end
  end
end
