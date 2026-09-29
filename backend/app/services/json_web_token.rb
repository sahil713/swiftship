class JsonWebToken
  ALGORITHM = "HS256".freeze
  TTL = 7.days

  def self.secret = ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }

  def self.encode(user)
    JWT.encode({ sub: user.id, role: user.role, exp: TTL.from_now.to_i }, secret, ALGORITHM)
  end

  def self.decode(token)
    JWT.decode(token, secret, true, algorithm: ALGORITHM).first
  rescue JWT::DecodeError
    nil
  end
end
