module Api
  module V1
    module Driver
      # The driver portal: a driver sees and works only on the tasks assigned to them.
      # Operations staff and admins can view and act on every task.
      class TasksController < ApplicationController
        before_action :authenticate!
        before_action -> { require_roles!(:driver, :operations, :admin) }
        before_action :load_task, except: :index

        rescue_from DriverTask::InvalidStep, with: ->(e) { render json: { error: e.message }, status: :unprocessable_entity }

        def index
          scope = tasks_scope.includes(:driver, :proofs, :events, booking: :service).order(:created_at)
          scope = params[:scope] == "completed" ? scope.finished.reorder(updated_at: :desc).limit(50) : scope.open.where.not(status: "unassigned")
          render json: scope.map { task_json(_1) }
        end

        def show = render_task

        # Each step below records who, when and (if the phone shares it) where.
        def start = step { @task.start!(user: current_user, geo:) }
        def arrive = step { @task.arrive!(user: current_user, geo:) }
        # Proof of Collection: handed over by, date/time, photos, notes and signature. Saving again corrects it.
        def collect = step { @task.save_collection_proof!(user: current_user, geo:, **proof_params) }
        def complete_collection = step { @task.complete_collection!(user: current_user, geo:) }
        # Collection task: items received and stored at the depot.
        def depot = step { @task.save_depot_proof!(user: current_user, geo:, **proof_params) }
        # Direct job: arrived at the delivery address after collecting.
        def arrive_delivery = step { @task.arrive_at_delivery!(user: current_user, geo:) }
        # Proof of Delivery: recipient, date/time, at least 2 photos, signature and notes.
        def proof = step { @task.save_delivery_proof!(user: current_user, geo:, **proof_params) }
        def complete = step { @task.complete_delivery!(user: current_user, geo:) }
        def close = step { @task.close!(user: current_user, geo:) }

        def report_issue
          kind = params.fetch(:kind, @task.current_side == "collection" ? "collection_issue" : "delivery_issue")
          return render(json: { error: "Invalid issue type" }, status: :unprocessable_entity) unless BookingNote::KINDS.include?(kind)

          booking = @task.booking
          body = params.require(:body)
          booking.notes.create!(user: current_user, kind:, body:)
          @task.report_issue!(user: current_user, body:)
          if params[:mark_exception].to_s == "true" && booking.can_transition_to?("exception")
            booking.transition_to!("exception", user: current_user, note: params[:customer_note].presence || "We've recorded an issue with your shipment.")
          end
          render_task
        end

        private

        def tasks_scope = current_user.driver? ? DriverTask.where(driver: current_user) : DriverTask.all

        def load_task = @task = tasks_scope.find(params[:id])

        def step
          yield
          render_task
        end

        # GPS position sent by the driver's phone, if they allowed location access.
        def geo
          lat = Float(params.dig(:geo, :latitude), exception: false)
          lng = Float(params.dig(:geo, :longitude), exception: false)
          return {} unless lat&.between?(-90, 90) && lng&.between?(-180, 180)
          { latitude: lat.round(6), longitude: lng.round(6), accuracy_m: Integer(params.dig(:geo, :accuracy_m).to_f.round, exception: false) }
        end

        def proof_params
          attrs = params.permit(:person_name, :occurred_at, :notes, :location, :signature_data, photos: []).to_h.symbolize_keys
          attrs[:photos] ||= []
          attrs
        end

        def render_task = render(json: task_json(@task.reload, full: true))

        # Only what the driver needs for this task: the address(es) and contacts for its legs.
        def task_json(task, full: false)
          b = task.booking
          side = task.current_side
          stop = lambda do |s|
            { contact_name: b["#{s}_contact_name"], contact_phone: b["#{s}_phone"], contact_email: b["#{s}_email"],
              address: { line1: b["#{s}_line1"], line2: b["#{s}_line2"], city: b["#{s}_city"], postcode: b["#{s}_postcode"] },
              instructions: b["#{s}_instructions"] }
          end
          data = task.as_json.merge(
            reference: b.reference, tracking_number: b.tracking_number, booking_status: b.status, service: b.service.name,
            date: side == "collection" ? b.collection_date : b.estimated_delivery_date,
            collection: (stop.call("collection") unless task.delivery?),
            delivery: (stop.call("delivery") unless task.collection?),
            special_requirements: b.special_requirements, customer_email: (b.customer_email unless task.delivery?),
            collection_signature_required: TaskProof.collection_signature_required?,
            item: { description: b.item_description, quantity: b.quantity, weight_kg: b.weight_kg&.to_f,
                    length_cm: b.length_cm&.to_f, width_cm: b.width_cm&.to_f, height_cm: b.height_cm&.to_f, fragile: b.fragile }
          ).merge(stop.call(side)) # contact_name/address etc. for the current stop, used by the task list
          # Lists only need proof summaries – images are sent with the single task.
          unless full
            data["proofs"] = task.proofs.to_h { [_1.kind, { "person_name" => _1.person_name, "photo_count" => _1.photos.size }] }
            data.delete("events")
          end
          data
        end
      end
    end
  end
end
