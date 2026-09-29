module Api
  module V1
    module Admin
      class SurchargesController < BaseController
        before_action :admin_only!, except: :index

        def index = render(json: Surcharge.order(:id))

        def create
          render json: Surcharge.create!(record_params), status: :created
        end

        def update
          record = Surcharge.find(params[:id])
          record.update!(record_params)
          render json: record
        end

        def destroy
          record = Surcharge.find(params[:id])
          return render_errors(record) unless record.destroy
          head :no_content
        end

        private

        def record_params = params.require(:surcharge).permit(:name, :code, :kind, :amount, :description, :active)
      end
    end
  end
end
