class User < ApplicationRecord
  ROLES = %w[customer driver operations admin].freeze
  STAFF_ROLES = %w[operations admin].freeze

  has_secure_password

  has_many :addresses, dependent: :destroy
  has_many :bookings, dependent: :nullify
  has_many :assigned_bookings, class_name: "Booking", foreign_key: :driver_id, dependent: :nullify

  normalizes :email, with: ->(email) { email.strip.downcase }

  validates :name, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validate :email_unique
  validates :role, inclusion: { in: ROLES }
  validates :password, length: { minimum: 8 }, allow_nil: true

  scope :customers, -> { where(role: "customer") }
  scope :drivers, -> { where(role: "driver", active: true) }

  def admin? = role == "admin"
  def staff? = STAFF_ROLES.include?(role)
  def driver? = role == "driver"

  def as_json(*)
    { id:, name:, email:, phone:, role:, active:, created_at: }
  end

  private

  def email_unique
    return if email.blank?
    scope = User.where("lower(email) = ?", email.downcase)
    scope = scope.where.not(id:) if persisted?
    errors.add(:email, "is already registered") if scope.exists?
  end
end
