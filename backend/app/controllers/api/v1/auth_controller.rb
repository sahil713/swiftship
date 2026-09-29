module Api
  module V1
    class AuthController < ApplicationController
      before_action :authenticate!, only: %i[me update_me]
      # Keyed by email rather than IP: in production requests arrive via the Vercel proxy,
      # so many customers can share one IP address.
      rate_limit to: 10, within: 3.minutes, only: :login,
                 by: -> { params[:email].to_s.strip.downcase },
                 with: -> { render json: { error: "Too many sign-in attempts. Please wait a few minutes." }, status: :too_many_requests }

      def register
        user = User.new(params.permit(:name, :email, :phone, :password).merge(role: "customer"))
        user.save!
        # Attach earlier guest bookings made with the same email address.
        Booking.where(user_id: nil, customer_email: user.email).update_all(user_id: user.id)
        render json: { token: JsonWebToken.encode(user), user: }, status: :created
      end

      def login
        user = User.find_by("lower(email) = ?", params[:email].to_s.strip.downcase)
        if user&.active && user.authenticate(params[:password].to_s)
          render json: { token: JsonWebToken.encode(user), user: }
        else
          render json: { error: "Incorrect email or password" }, status: :unauthorized
        end
      end

      def me
        render json: { user: current_user }
      end

      def update_me
        attrs = params.permit(:name, :phone, :password)
        if attrs[:password].present? && !current_user.authenticate(params[:current_password].to_s)
          return render json: { error: "Current password is incorrect" }, status: :unprocessable_entity
        end
        attrs.delete(:password) if attrs[:password].blank?
        current_user.update!(attrs)
        render json: { user: current_user }
      end
    end
  end
end
