module Api
  module V1
    module Admin
      class BaseController < ApplicationController
        before_action :authenticate!
        before_action -> { require_roles!(:admin, :operations) }

        private

        def admin_only! = require_roles!(:admin)
      end
    end
  end
end
