module Api
  module V1
    module Admin
      class SettingsController < BaseController
        before_action :admin_only!, only: :update

        def show = render(json: Setting.all_values)

        def update
          values = params.require(:settings).permit(*Setting::DEFAULTS.keys).to_h
          Setting.transaction do
            values.each do |key, value|
              value = ActiveModel::Type::Boolean.new.cast(value) if [true, false].include?(Setting::DEFAULTS[key])
              Setting.set(key, value)
            end
          end
          render json: Setting.all_values
        end
      end
    end
  end
end
