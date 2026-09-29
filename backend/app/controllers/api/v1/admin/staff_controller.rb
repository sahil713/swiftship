module Api
  module V1
    module Admin
      class StaffController < BaseController
        before_action :admin_only!, except: :index

        def index = render(json: User.where.not(role: "customer").order(:role, :name))

        def create
          render json: User.create!(staff_params), status: :created
        end

        def update
          user = User.where.not(role: "customer").find(params[:id])
          attrs = staff_params
          attrs.delete(:password) if attrs[:password].blank?
          if user == current_user && (attrs[:role].present? && attrs[:role] != "admin" || attrs[:active].to_s == "false")
            return render json: { error: "You can't remove your own admin access" }, status: :unprocessable_entity
          end
          user.update!(attrs)
          render json: user
        end

        private

        def staff_params
          attrs = params.require(:user).permit(:name, :email, :phone, :role, :password, :active)
          raise ActionController::BadRequest, "Invalid role" if attrs[:role].present? && !%w[driver operations admin].include?(attrs[:role])
          attrs
        end
      end
    end
  end
end
