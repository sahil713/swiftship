module Api
  module V1
    module Admin
      class CustomersController < BaseController
        def index
          scope = User.customers.order(created_at: :desc)
          if params[:q].present?
            term = "%#{User.sanitize_sql_like(params[:q].strip)}%"
            scope = scope.where("name ILIKE :t OR email ILIKE :t OR phone ILIKE :t", t: term)
          end
          users, meta = paginate(scope)
          counts = Booking.where(user_id: users.map(&:id)).group(:user_id).count
          render json: { customers: users.map { _1.as_json.merge(bookings_count: counts[_1.id].to_i) }, meta: }
        end

        def show
          user = User.customers.find(params[:id])
          render json: {
            customer: user, addresses: user.addresses,
            bookings: user.bookings.includes(:service, :driver).order(created_at: :desc).limit(100).map(&:summary_json)
          }
        end

        def update
          user = User.customers.find(params[:id])
          user.update!(params.require(:customer).permit(:name, :phone, :active))
          render json: { customer: user }
        end
      end
    end
  end
end
