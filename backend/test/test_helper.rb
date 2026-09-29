ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    parallelize(workers: 1)

    def seed_catalog!
      Rails.application.load_seed
    end
  end
end

class ActionDispatch::IntegrationTest
  def auth_headers(email)
    post "/api/v1/auth/login", params: { email:, password: "password123" }, as: :json
    { "Authorization" => "Bearer #{response.parsed_body['token']}" }
  end

  def json = response.parsed_body
end
