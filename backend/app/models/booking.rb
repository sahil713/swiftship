class Booking < ApplicationRecord
  STATUSES = %w[
    quote_requested awaiting_payment booked collected in_warehouse in_transit
    out_for_delivery delivered failed_delivery exception cancelled
  ].freeze

  STATUS_LABELS = {
    "quote_requested" => "Quote requested",
    "awaiting_payment" => "Price confirmed – awaiting payment",
    "booked" => "Booked",
    "collected" => "Collected",
    "in_warehouse" => "At our warehouse",
    "in_transit" => "In transit",
    "out_for_delivery" => "Out for delivery",
    "delivered" => "Delivered",
    "failed_delivery" => "Delivery attempted",
    "exception" => "Exception",
    "cancelled" => "Cancelled"
  }.freeze

  # Statuses staff or drivers may move a booking to from each state.
  TRANSITIONS = {
    # quote_requested → booked: price agreed with the customer by phone (phase 1, no online payment).
    "quote_requested" => %w[booked awaiting_payment cancelled],
    "awaiting_payment" => %w[booked cancelled],
    "booked" => %w[collected exception cancelled],
    "collected" => %w[in_warehouse in_transit exception],
    "in_warehouse" => %w[out_for_delivery in_transit exception],
    "in_transit" => %w[in_warehouse out_for_delivery exception],
    "out_for_delivery" => %w[delivered failed_delivery exception],
    "failed_delivery" => %w[out_for_delivery in_warehouse in_transit exception cancelled],
    "exception" => %w[booked collected in_warehouse in_transit out_for_delivery failed_delivery cancelled],
    "delivered" => %w[exception],
    "cancelled" => []
  }.freeze

  ACTIVE_JOB_STATUSES = %w[booked collected in_warehouse in_transit out_for_delivery failed_delivery exception].freeze
  NOTIFY_STATUSES = %w[awaiting_payment booked collected out_for_delivery delivered failed_delivery exception cancelled].freeze
  PAYMENT_STATUSES = %w[unpaid paid partially_refunded refunded].freeze

  belongs_to :user, optional: true
  belongs_to :service
  belongs_to :driver, class_name: "User", optional: true

  has_many :status_events, -> { order(:created_at, :id) }, dependent: :destroy
  has_many :notes, -> { order(created_at: :desc) }, class_name: "BookingNote", dependent: :destroy
  has_many :payments, -> { order(:created_at) }, dependent: :destroy
  has_many :change_requests, -> { order(created_at: :desc) }, dependent: :destroy
  has_many :notifications, -> { order(created_at: :desc) }, dependent: :destroy
  has_one :proof_of_delivery, dependent: :destroy # legacy single POD, kept for older jobs
  has_many :driver_tasks, -> { order(:created_at, :id) }, dependent: :destroy

  %i[collection_postcode delivery_postcode].each do |attr|
    normalizes attr, with: ->(pc) { UkPostcode.format(pc) || pc.to_s.upcase.strip }
  end
  normalizes :collection_email, :delivery_email, :customer_email, with: ->(e) { e.strip.downcase }

  validates :status, inclusion: { in: STATUSES }
  validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
  validates :collection_contact_name, :collection_phone, :collection_email, :collection_line1,
            :collection_city, :collection_postcode, :delivery_contact_name, :delivery_phone,
            :delivery_email, :delivery_line1, :delivery_city, :delivery_postcode,
            :item_description, :customer_email, presence: true
  validates :collection_email, :delivery_email, :customer_email,
            format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :collection_phone, :delivery_phone, format: { with: /\A\+?[0-9 ()-]{10,20}\z/, message: "is not a valid phone number" }, allow_blank: true
  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 100 }
  validates :weight_kg, :length_cm, :width_cm, :height_cm, numericality: { greater_than: 0 }, allow_nil: true
  validate :collection_date_not_in_past, on: :create

  before_validation :assign_identifiers, on: :create

  scope :search, lambda { |q|
    next all if q.blank?
    term = "%#{sanitize_sql_like(q.strip)}%"
    where("bookings.reference ILIKE :t OR bookings.tracking_number ILIKE :t OR bookings.customer_email ILIKE :t " \
          "OR bookings.collection_contact_name ILIKE :t OR bookings.delivery_contact_name ILIKE :t " \
          "OR bookings.collection_postcode ILIKE :t OR bookings.delivery_postcode ILIKE :t " \
          "OR bookings.collection_city ILIKE :t OR bookings.delivery_city ILIKE :t", t: term)
  }

  def self.status_label(status) = STATUS_LABELS.fetch(status, status.to_s.humanize)

  def to_param = reference

  def price_pence = confirmed_price_pence || estimated_price_pence

  def collection_task = driver_tasks.where(kind: "collection").where.not(status: "cancelled").last
  def delivery_task = driver_tasks.where(kind: "delivery").where.not(status: "cancelled").last

  # Keeps bookings.driver pointing at whoever currently holds the job (for lists and filters).
  def sync_driver!
    current = driver_tasks.open.last || driver_tasks.where.not(status: "cancelled").last
    update_column(:driver_id, current.driver_id) if current && driver_id != current.driver_id
  end

  # Flags the request for admin review when either end is outside the normal service area.
  def apply_area_review(collection:, delivery:)
    notes = ServiceArea.review_notes(collection:, delivery:)
    self.area_review = notes.any?
    self.area_review_notes = notes.join("\n").presence
  end

  def payable? = status == "awaiting_payment" && payment_status == "unpaid" && confirmed_price_pence.present?

  def cancellable_by_customer? = %w[quote_requested awaiting_payment booked].include?(status)

  def can_transition_to?(new_status) = TRANSITIONS.fetch(status, []).include?(new_status)

  def paid_pence = payments.succeeded.sum(:amount_pence) - payments.sum(:refunded_pence)

  # Moves the booking to a new status, recording a timestamped history event and
  # notifying the customer when the change is one they care about.
  def transition_to!(new_status, user: nil, note: nil, location: nil, customer_visible: true, force: false)
    new_status = new_status.to_s
    raise ArgumentError, "Unknown status #{new_status}" unless STATUSES.include?(new_status)
    unless force || can_transition_to?(new_status)
      errors.add(:status, "cannot change from #{self.class.status_label(status)} to #{self.class.status_label(new_status)}")
      raise ActiveRecord::RecordInvalid, self
    end

    transaction do
      self.status = new_status
      self.booked_at ||= Time.current if new_status == "booked"
      self.delivered_at = Time.current if new_status == "delivered"
      save!
      status_events.create!(status: new_status, user:, note:, location:, customer_visible:)
      driver_tasks.open.update_all(status: "cancelled", updated_at: Time.current) if new_status == "cancelled"
    end
    BookingNotifier.status_changed(self, note:) if NOTIFY_STATUSES.include?(new_status)
    self
  end

  def confirm_price!(pence, user: nil, note: nil)
    self.confirmed_price_pence = pence
    self.price_confirmed_at = Time.current
    if status == "quote_requested"
      transition_to!("awaiting_payment", user:, note: note || "Price confirmed at #{Money.format(pence)}")
    else
      save!
    end
  end

  def collection_address = [collection_line1, collection_line2, collection_city, collection_postcode].compact_blank.join(", ")
  def delivery_address = [delivery_line1, delivery_line2, delivery_city, delivery_postcode].compact_blank.join(", ")

  def summary_json
    {
      reference:, tracking_number:, status:, status_label: self.class.status_label(status),
      payment_status:, service: service.slice(:id, :name, :slug),
      collection_city:, collection_postcode:, delivery_city:, delivery_postcode:,
      item_description:, quantity:, price_pence:, confirmed_price_pence:, estimated_price_pence:,
      collection_date:, estimated_delivery_date:, created_at:, updated_at:,
      customer_email:, driver: driver&.slice(:id, :name), area_review:
    }
  end

  def detail_json(staff: false)
    data = summary_json.merge(
      attributes.slice(*%w[
        collection_contact_name collection_phone collection_email collection_line1 collection_line2
        delivery_contact_name delivery_phone delivery_email delivery_line1 delivery_line2
        weight_kg length_cm width_cm height_cm fragile collection_instructions delivery_instructions
        special_requirements price_breakdown price_confirmed_at booked_at delivered_at
      ]),
      payable: payable?,
      cancellable: cancellable_by_customer?,
      events: (staff ? status_events : status_events.where(customer_visible: true)).includes(:user).map(&:as_json),
      payments: payments.map(&:as_json),
      change_requests: change_requests.map(&:as_json),
      proof_of_delivery: proof_of_delivery&.as_json,
      tasks: driver_tasks.includes(:driver, proof: :user).map(&:as_json)
    )
    if staff
      data.merge!(
        id:, user: user&.as_json, notes: notes.includes(:user).map(&:as_json), area_review_notes:,
        notifications: notifications.limit(50).map(&:as_json),
        allowed_transitions: TRANSITIONS.fetch(status, []), paid_pence:
      )
    end
    data
  end

  # Limited view for public tracking by tracking number – no names, phones or full addresses.
  def tracking_json
    {
      tracking_number:, status:, status_label: self.class.status_label(status),
      service: service.name,
      from: "#{collection_city}, #{collection_postcode.split.first}",
      to: "#{delivery_city}, #{delivery_postcode.split.first}",
      collection_date:, estimated_delivery_date:, delivered_at:,
      events: status_events.where(customer_visible: true).map { _1.as_json.except("by", :by) },
      delivered_to: delivery_task&.proof&.person_name || proof_of_delivery&.recipient_name
    }
  end

  private

  def assign_identifiers
    self.reference ||= loop do
      ref = "SS-#{Time.current.strftime('%y%m')}-#{SecureRandom.alphanumeric(6).upcase}"
      break ref unless Booking.exists?(reference: ref)
    end
    self.tracking_number ||= loop do
      tn = "SSUK#{SecureRandom.random_number(10**10).to_s.rjust(10, '0')}"
      break tn unless Booking.exists?(tracking_number: tn)
    end
    self.guest_token ||= SecureRandom.urlsafe_base64(24)
  end

  def collection_date_not_in_past
    errors.add(:collection_date, "cannot be in the past") if collection_date.present? && collection_date < Date.current
  end
end
