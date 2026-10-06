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
          scope = params[:scope] == "completed" ? scope.finished.reorder(updated_at: :desc).limit(50) : scope.open
          render json: scope.map { task_json(_1) }
        end

        def show = render_task

        # Proof of Collection: who handed the items over, when, photos, notes and optional signature.
        def collect
          @task.record_collection!(user: current_user, **proof_params)
          render_task
        end

        def arrive
          @task.arrive!(user: current_user)
          render_task
        end

        # Direct jobs: arrived at the delivery address after collecting.
        def arrive_delivery
          @task.arrive_at_delivery!(user: current_user)
          render_task
        end

        # Collection task: items checked in at the depot (photos + signature), closing the task.
        def close
          @task.close_at_depot!(user: current_user, note: params[:note], **proof_params)
          render_task
        end

        def start
          @task.start!(user: current_user)
          render_task
        end

        # Proof of Delivery: recipient name, date/time, notes, photos and customer signature.
        def proof
          @task.record_delivery_proof!(user: current_user, **proof_params)
          render_task
        end

        def complete
          @task.complete_delivery!(user: current_user)
          render_task
        end

        def report_issue
          kind = params.fetch(:kind, @task.collection? ? "collection_issue" : "delivery_issue")
          return render(json: { error: "Invalid issue type" }, status: :unprocessable_entity) unless BookingNote::KINDS.include?(kind)

          booking = @task.booking
          booking.notes.create!(user: current_user, kind:, body: params.require(:body))
          if params[:mark_exception].to_s == "true" && booking.can_transition_to?("exception")
            booking.transition_to!("exception", user: current_user, note: params[:customer_note].presence || "We've recorded an issue with your shipment.")
          end
          render_task
        end

        private

        def tasks_scope = current_user.driver? ? DriverTask.where(driver: current_user) : DriverTask.all

        def load_task = @task = tasks_scope.find(params[:id])

        def proof_params
          attrs = params.permit(:person_name, :occurred_at, :notes, :signature_data, photos: []).to_h.symbolize_keys
          attrs[:occurred_at] = attrs[:occurred_at].presence || Time.current
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
