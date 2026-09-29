module Api
  module V1
    module Admin
      class EnquiriesController < BaseController
        def index
          scope = Enquiry.includes(:booking).order(created_at: :desc)
          scope = scope.where(status: params[:status]) if params[:status].present?
          enquiries, meta = paginate(scope)
          render json: { enquiries:, meta: }
        end

        def update
          enquiry = Enquiry.find(params[:id])
          enquiry.update!(params.require(:enquiry).permit(:status, :response))
          render json: enquiry
        end
      end
    end
  end
end
