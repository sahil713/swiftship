class ApplicationController < ActionController::API
  class Forbidden < StandardError; end

  rescue_from ActiveRecord::RecordNotFound, with: -> { render json: { error: "Not found" }, status: :not_found }
  rescue_from ActiveRecord::RecordInvalid, with: ->(e) { render_errors(e.record) }
  rescue_from ActionController::ParameterMissing, with: ->(e) { render json: { error: e.message }, status: :bad_request }
  rescue_from Forbidden, with: -> { render json: { error: "You don't have access to that" }, status: :forbidden }

  private

  def current_user
    return @current_user if defined?(@current_user)
    token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
    payload = token && JsonWebToken.decode(token)
    @current_user = payload && User.find_by(id: payload["sub"], active: true)
  end

  def authenticate!
    render json: { error: "Please sign in" }, status: :unauthorized unless current_user
  end

  def require_roles!(*roles)
    return if performed?
    raise Forbidden unless current_user && roles.map(&:to_s).include?(current_user.role)
  end

  def render_errors(record, status: :unprocessable_entity)
    render json: { error: record.errors.full_messages.to_sentence, errors: record.errors.to_hash(true) }, status:
  end

  def page_params
    page = [params.fetch(:page, 1).to_i, 1].max
    per = params.fetch(:per, 20).to_i.clamp(1, 100)
    [page, per]
  end

  def paginate(scope)
    page, per = page_params
    total = scope.count
    [scope.offset((page - 1) * per).limit(per), { page:, per:, total:, pages: (total / per.to_f).ceil }]
  end
end
