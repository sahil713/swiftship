# One task for a driver on a job.
#
# collection: assigned → started → arrived → collected (POC) → closed (depot proof)   – then a delivery task is created
# delivery:   assigned → started → arrived → [POD] → completed
# direct:     assigned → started → arrived → collected (POC) → arrived_delivery → [POD] → completed
#
# Every step is recorded as a TaskEvent and timestamped on the task, so admins can see who did
# what, when, and how long each stage took. Admins can unassign a task until the items are collected.
class DriverTask < ApplicationRecord
  KINDS = %w[collection delivery direct].freeze
  STATUSES = %w[unassigned assigned started arrived collected arrived_delivery closed completed cancelled].freeze
  OPEN_STATUSES = %w[unassigned assigned started arrived collected arrived_delivery].freeze
  UNASSIGNABLE = %w[assigned started arrived].freeze

  class InvalidStep < StandardError; end

  belongs_to :booking
  belongs_to :driver, class_name: "User", optional: true
  has_many :proofs, class_name: "TaskProof", dependent: :destroy
  has_many :events, -> { order(:occurred_at, :id) }, class_name: "TaskEvent", dependent: :destroy

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :driver, presence: true, unless: -> { %w[unassigned cancelled].include?(status) }
  validate :driver_is_a_driver, if: -> { driver_id_changed? && driver }

  scope :open, -> { where(status: OPEN_STATUSES) }
  scope :finished, -> { where(status: %w[closed completed]) }

  def collection? = kind == "collection"
  def delivery? = kind == "delivery"
  def direct? = kind == "direct"
  def open? = OPEN_STATUSES.include?(status)
  def proof_of(kind) = proofs.detect { _1.kind == kind }

  # Which address the driver is working at right now.
  def current_side
    return "delivery" if delivery?
    return "collection" if collection?
    %w[collected arrived_delivery completed].include?(status) ? "delivery" : "collection"
  end

  def status_label
    case status
    when "unassigned" then "Unassigned"
    when "assigned" then "Assigned"
    when "started" then delivery? ? "Out for Delivery" : "In Progress"
    when "arrived" then delivery? ? "Arrived at Delivery" : "Arrived at Collection"
    when "collected" then direct? ? "Collected – In Transit" : "Collected"
    when "arrived_delivery" then "Arrived at Delivery"
    when "closed" then "At Depot"
    when "completed" then "Completed"
    when "cancelled" then "Cancelled"
    end
  end

  # ---- Office actions ----

  def assign_to!(new_driver, by: nil)
    step!("This task is already finished") { open? }
    previous = driver
    update!(driver: new_driver, status: status == "unassigned" ? "assigned" : status)
    log!(previous ? "reassigned" : "assigned", by, previous ? "#{previous.name} → #{new_driver.name}" : new_driver.name)
    booking.sync_driver!
  end

  def unassign!(by: nil)
    step!("The driver already has the items – reassign the task to another driver instead") { UNASSIGNABLE.include?(status) }
    previous = driver
    update!(driver: nil, status: "unassigned", started_at: nil, arrived_at: nil)
    log!("unassigned", by, previous&.name)
    booking.sync_driver!
  end

  # ---- Driver actions ----

  def start!(user:)
    step!("This task has already been started") { status == "assigned" }
    transaction do
      update!(status: "started", started_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) if delivery? && booking.status != "out_for_delivery"
      log!("started", user)
    end
  end

  def arrive!(user:)
    step!("Set off before marking arrival") { status == "started" }
    update!(status: "arrived", arrived_at: Time.current)
    log!("arrived", user, current_side == "collection" ? booking.collection_address : booking.delivery_address)
  end

  # Proof of Collection – the items are now with the driver.
  def record_collection!(user:, **proof_attrs)
    step!("Mark that you've arrived at the collection address first") { (collection? || direct?) && status == "arrived" }
    transaction do
      proof = proofs.create!(proof_attrs.merge(kind: "collection", user:))
      # Stage timings use the server clock; the proof keeps the time the driver entered.
      update!(status: "collected", collected_at: Time.current)
      # Public tracking shows this note, so no names here – the POC record keeps who handed over the items.
      booking.transition_to!("collected", user:, note: "Items collected", location: booking.collection_city)
      booking.transition_to!("in_transit", user:, note: "On the way to the delivery address") if direct?
      log!("collected", user, "Handed over by #{proof.person_name}")
    end
  end

  # Collection task: items checked in at the depot with photos and a signature, closing the task.
  def close_at_depot!(user:, note: nil, **proof_attrs)
    step!("Submit the proof of collection before checking in at the depot") { collection? && status == "collected" }
    transaction do
      proofs.create!(proof_attrs.merge(kind: "depot", user:))
      update!(status: "closed", closed_at: Time.current, warehouse_note: note.presence)
      booking.transition_to!("in_warehouse", user:, note: "Items received at our depot")
      unless booking.driver_tasks.where(kind: "delivery").where.not(status: "cancelled").exists?
        delivery = booking.driver_tasks.create!(kind: "delivery", driver:)
        delivery.events.create!(action: "assigned", note: "#{driver.name} – automatically after depot check-in", occurred_at: Time.current)
      end
      log!("depot", user, note.presence)
      booking.sync_driver!
    end
  end

  # Direct job: after collecting, the driver arrives at the delivery address.
  def arrive_at_delivery!(user:)
    step!("Submit the proof of collection first") { direct? && status == "collected" }
    transaction do
      update!(status: "arrived_delivery", arrived_delivery_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) unless booking.status == "out_for_delivery"
      log!("arrived_delivery", user, booking.delivery_address)
    end
  end

  # Proof of Delivery – at least two photos and the recipient's signature. Can be corrected until closed.
  def record_delivery_proof!(user:, **proof_attrs)
    step!("Mark that you've arrived at the delivery address first") { at_delivery_address? }
    record = proof_of("delivery") || proofs.build(kind: "delivery")
    first_time = record.new_record?
    record.update!(proof_attrs.merge(kind: "delivery", user:))
    log!("pod_recorded", user, "Received by #{record.person_name}") if first_time
    record
  end

  # Driver closes the delivery once the POD is on record.
  def complete_delivery!(user:)
    step!("Record the proof of delivery (2 photos and a signature) before closing the task") { at_delivery_address? && proof_of("delivery") }
    pod = proof_of("delivery")
    transaction do
      update!(status: "completed", completed_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) unless booking.status == "out_for_delivery"
      booking.transition_to!("delivered", user:, note: "Delivered to #{pod.person_name}", location: booking.delivery_city)
      log!("completed", user)
      booking.sync_driver!
    end
  end

  # ---- Timing ----

  STAGES = {
    "collection" => [["Travel to collection", :started_at, :arrived_at], ["At collection", :arrived_at, :collected_at],
                     ["Collection to depot", :collected_at, :closed_at]],
    "delivery" => [["Travel to delivery", :started_at, :arrived_at], ["At delivery", :arrived_at, :completed_at]],
    "direct" => [["Travel to collection", :started_at, :arrived_at], ["At collection", :arrived_at, :collected_at],
                 ["Travel to delivery", :collected_at, :arrived_delivery_at], ["At delivery", :arrived_delivery_at, :completed_at]]
  }.freeze

  def finished_at = closed_at || completed_at

  # Seconds spent on each stage (nil until the stage has finished) and in total, from setting off.
  def timings
    stages = STAGES.fetch(kind).map do |label, from, to|
      a, b = public_send(from), public_send(to)
      { label:, seconds: a && b ? (b - a).round : nil, in_progress: a.present? && b.nil? && open? }
    end
    total = started_at && finished_at ? (finished_at - started_at).round : nil
    { stages:, total_seconds: total, running_since: (started_at if started_at && !finished_at && open?) }
  end

  def as_json(*)
    slice(:id, :kind, :status, :warehouse_note, :started_at, :arrived_at, :collected_at, :arrived_delivery_at,
          :closed_at, :completed_at, :created_at)
      .merge(status_label:, current_side:, driver: driver&.slice(:id, :name), timings:,
             proofs: proofs.to_h { [_1.kind, _1.as_json] },
             events: events.includes(:user).map(&:as_json))
  end

  private

  def at_delivery_address?
    (delivery? && status == "arrived") || (direct? && status == "arrived_delivery")
  end

  def log!(action, user, note = nil)
    events.create!(action:, user:, note:, occurred_at: Time.current)
  end

  def step!(message)
    raise InvalidStep, message unless yield
  end

  def driver_is_a_driver
    errors.add(:driver, "must be an active driver") unless driver&.role == "driver" && driver.active
  end
end
