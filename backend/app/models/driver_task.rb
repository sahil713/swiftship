# One leg of a job for a driver: collecting the items, or delivering them.
#
# Collection: assigned → collected (POC submitted) → closed (items in the warehouse)
# Delivery:   assigned → started (optional) → completed (POD submitted)
class DriverTask < ApplicationRecord
  KINDS = %w[collection delivery].freeze
  STATUSES = %w[assigned started collected closed completed cancelled].freeze
  OPEN_STATUSES = %w[assigned started collected].freeze
  STATUS_LABELS = {
    "assigned" => "Assigned", "started" => "On the way", "collected" => "Collected",
    "closed" => "In warehouse – closed", "completed" => "Completed", "cancelled" => "Cancelled"
  }.freeze

  class InvalidStep < StandardError; end

  belongs_to :booking
  belongs_to :driver, class_name: "User"
  has_one :proof, class_name: "TaskProof", dependent: :destroy

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validate :driver_is_a_driver

  scope :open, -> { where(status: OPEN_STATUSES) }
  scope :finished, -> { where(status: %w[closed completed]) }

  def collection? = kind == "collection"
  def delivery? = kind == "delivery"
  def open? = OPEN_STATUSES.include?(status)

  # Driver submits the Proof of Collection; the items are now with the driver.
  def record_collection!(user:, **proof_attrs)
    step!("Proof of collection can only be submitted for an assigned collection task") { collection? && status == "assigned" }
    transaction do
      create_proof!(proof_attrs.merge(kind: "collection", user:))
      update!(status: "collected", collected_at: proof.occurred_at)
      # Public tracking shows this note, so no names here – the POC record keeps who handed over the items.
      booking.transition_to!("collected", user:, note: "Items collected", location: booking.collection_city)
    end
  end

  # Driver confirms the items are in the warehouse. Closes the task and creates the delivery task.
  def close_at_warehouse!(user:, note: nil)
    step!("Submit the proof of collection before closing this task") { collection? && status == "collected" }
    transaction do
      update!(status: "closed", closed_at: Time.current, warehouse_note: note.presence)
      booking.transition_to!("in_warehouse", user:, note: "Items received at our warehouse")
      booking.driver_tasks.create!(kind: "delivery", driver:) unless booking.driver_tasks.where(kind: "delivery").where.not(status: "cancelled").exists?
      booking.sync_driver!
    end
  end

  # Optional: driver sets off with the delivery (customer gets an "out for delivery" update).
  def start_delivery!(user:)
    step!("This delivery has already been started or finished") { delivery? && status == "assigned" }
    transaction do
      update!(status: "started", started_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) unless booking.status == "out_for_delivery"
    end
  end

  # Driver records the Proof of Delivery (can be corrected until the task is completed).
  def record_delivery_proof!(user:, **proof_attrs)
    step!("Proof of delivery can only be recorded for an open delivery task") { delivery? && %w[assigned started].include?(status) }
    record = proof || build_proof
    record.update!(proof_attrs.merge(kind: "delivery", user:))
    record
  end

  # Driver marks the delivery completed once the full POD is on record.
  def complete_delivery!(user:)
    step!("Record the full proof of delivery before completing") { delivery? && %w[assigned started].include?(status) && proof&.complete_for_delivery? }
    transaction do
      update!(status: "completed", completed_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) unless booking.status == "out_for_delivery"
      booking.transition_to!("delivered", user:, note: "Delivered to #{proof.person_name}", location: booking.delivery_city)
      booking.sync_driver!
    end
  end

  def as_json(*)
    slice(:id, :kind, :status, :warehouse_note, :started_at, :collected_at, :closed_at, :completed_at, :created_at)
      .merge(status_label: STATUS_LABELS[status], driver: driver.slice(:id, :name), proof: proof&.as_json)
  end

  private

  def step!(message)
    raise InvalidStep, message unless yield
  end

  def driver_is_a_driver
    errors.add(:driver, "must be an active driver") unless driver&.role == "driver" && driver.active
  end
end
