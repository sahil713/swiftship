class User < ApplicationRecord
  ROLES = %w[customer driver operations admin].freeze
  TRANSMISSIONS = %w[manual automatic].freeze
  VISA_STATUSES = [
    "British or Irish citizen", "EU Settled Status", "EU Pre-settled Status", "Indefinite Leave to Remain",
    "Skilled Worker visa", "Graduate visa", "Student visa", "Family visa", "Other"
  ].freeze
  # Sensitive driver details, shown to admins only.
  SENSITIVE_DRIVER_FIELDS = %i[licence_number passport_number bank_account_name bank_sort_code bank_account_number visa_status visa_expiry].freeze
  STAFF_ROLES = %w[operations admin].freeze

  has_secure_password
  encrypts :licence_number, :passport_number, :bank_sort_code, :bank_account_number

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

  # Driver profile. Licence and gearbox are required for new drivers; older accounts may lack them.
  validates :first_name, :last_name, presence: true, if: :driver?
  validates :phone, presence: true, if: -> { driver? && new_record? }
  validates :licence_number, :transmission, presence: true, if: -> { driver? && new_record? }
  validates :transmission, inclusion: { in: TRANSMISSIONS }, allow_blank: true
  validates :visa_status, inclusion: { in: VISA_STATUSES }, allow_blank: true
  validates :bank_sort_code, format: { with: /\A\d{2}-?\d{2}-?\d{2}\z/, message: "must be 6 digits, e.g. 12-34-56" }, allow_blank: true
  validates :bank_account_number, format: { with: /\A\d{8}\z/, message: "must be 8 digits" }, allow_blank: true

  before_validation :compose_name
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

  def driver_profile_json(include_sensitive:)
    data = as_json.merge(first_name:, last_name:, transmission:)
    return data unless include_sensitive
    data.merge(SENSITIVE_DRIVER_FIELDS.to_h { [_1, public_send(_1)] })
  end

  # Signs in with either an email address or a username.
  def self.find_for_login(login)
    value = login.to_s.strip.downcase
    return nil if value.empty?
    find_by("lower(email) = :v OR lower(username) = :v", v: value)
  end

  private

  def compose_name
    full = [first_name, last_name].map { _1.to_s.strip }.compact_blank.join(" ")
    self.name = full if full.present?
  end

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
