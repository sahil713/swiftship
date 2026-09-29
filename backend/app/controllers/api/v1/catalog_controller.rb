module Api
  module V1
    # Public reference data: services, areas, surcharges, contact details.
    class CatalogController < ApplicationController
      def services
        render json: Service.active.ordered
      end

      def service
        render json: Service.active.find_by!(slug: params[:slug])
      end

      def areas
        render json: {
          areas: DeliveryArea.order(:zone, :name),
          northern_ireland_enabled: Setting.get(:northern_ireland_enabled)
        }
      end

      def surcharges
        render json: Surcharge.active.order(:id)
      end

      def site
        render json: Setting.all_values.slice("support_email", "support_phone", "northern_ireland_enabled")
      end

      def postcode
        render json: ServiceArea.check(params[:postcode])
      end
    end
  end
end
