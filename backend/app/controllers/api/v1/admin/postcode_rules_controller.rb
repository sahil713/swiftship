module Api
  module V1
    module Admin
      class PostcodeRulesController < BaseController
        before_action :admin_only!, except: :index

        def index = render(json: PostcodeRule.order(:level, :postcode_area))

        def create
          render json: PostcodeRule.create!(record_params), status: :created
        end

        def update
          record = PostcodeRule.find(params[:id])
          record.update!(record_params)
          render json: record
        end

        def destroy
          PostcodeRule.find(params[:id]).destroy!
          head :no_content
        end

        private

        def record_params = params.require(:postcode_rule).permit(:postcode_area, :level, :note, :active)
      end
    end
  end
end
