class User < ApplicationRecord
  ROLES = %w[customer driver operations admin].freeze
  STAFF_ROLES = %w[operations admin].freeze

  has_secure_password

  has_many :addresses, dependent: :destroy
  has_many :bookings, dependent: :nullify
  has_many :assigned_bookings, class_name: "Booking", foreign_key: :driver_id, dependent: :nullify

  has_many :driver_tasks, foreign_key: :driver_id, dependent: :restrict_with_error

  normalizes :email, with: ->(email) { email.strip.downcase.presence }
  normalizes :username, with: ->(name) { name.strip.downcase.presence }

  validates :name, presence: true
  # Everyone signs in with an email, except drivers, who may use a username instead.
  validates :email, presence: true, unless: -> { driver? && username.present? }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :username, format: { with: /\A[a-z0-9._-]{3,30}\z/, message: "must be 3–30 letters, numbers, dots, dashes or underscores" }, allow_blank: true
  validate :email_unique
  validate :username_unique
  validates :role, inclusion: { in: ROLES }
  validates :password, length: { minimum: 8 }, allow_nil: true

  scope :customers, -> { where(role: "customer") }
  scope :drivers, -> { where(role: "driver", active: true) }

  def admin? = role == "admin"
  def staff? = STAFF_ROLES.include?(role)
  def driver? = role == "driver"

  def as_json(*)
    { id:, name:, email:, username:, phone:, role:, active:, created_at: }
  end

  # Signs in with either an email address or a username.
  def self.find_for_login(login)
    value = login.to_s.strip.downcase
    return nil if value.empty?
    find_by("lower(email) = :v OR lower(username) = :v", v: value)
  end

  private

  def username_unique
    return if username.blank?
    scope = User.where("lower(username) = ?", username.downcase)
    scope = scope.where.not(id:) if persisted?
    errors.add(:username, "is already taken") if scope.exists?
  end

  def email_unique
    return if email.blank?
    scope = User.where("lower(email) = ?", email.downcase)
    scope = scope.where.not(id:) if persisted?
    errors.add(:email, "is already registered") if scope.exists?
  end
end
