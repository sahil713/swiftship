module Api
  module V1
    module Admin
      # Saved bank / payment details. Office staff can use them; only admins can change them.
      class PaymentMethodsController < BaseController
        before_action :admin_only!, except: :index

        def index
          scope = PaymentMethod.ordered
          scope = scope.active if params[:active] == "1"
          render json: scope
        end

        def create = render(json: PaymentMethod.create!(record_params), status: :created)

        def update
          record = PaymentMethod.find(params[:id])
          record.update!(record_params)
          render json: record
        end

        def destroy
          PaymentMethod.find(params[:id]).destroy!
          head :no_content
        end

        private

        def record_params
          params.require(:payment_method).permit(:name, :bank_name, :account_name, :account_number, :sort_code, :iban, :swift_bic, :instructions, :active, :position)
        end
      end
    end
  end
end
