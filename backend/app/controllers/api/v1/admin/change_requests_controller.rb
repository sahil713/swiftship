module Api
  module V1
    module Admin
      class ChangeRequestsController < BaseController
        def index
          scope = ChangeRequest.includes(:booking).order(created_at: :desc)
          scope = scope.where(status: params.fetch(:status, "pending")) unless params[:status] == "all"
          requests, meta = paginate(scope)
          render json: {
            change_requests: requests.map { _1.as_json.merge(booking: _1.booking.slice(:reference, :status, :payment_status, :customer_email)) },
            meta:
          }
        end
      end
    end
  end
end
