module Api
  module V1
    module Admin
      # Every driver task across all jobs, with assignment controls.
      class TasksController < BaseController
        before_action :load_task, except: :index
        rescue_from DriverTask::InvalidStep, with: ->(e) { render json: { error: e.message }, status: :unprocessable_entity }

        def index
          scope = DriverTask.includes(:driver, :proofs, booking: :service).order(updated_at: :desc)
          case params[:status].presence || "open"
          when "all" then nil
          when "open" then scope = scope.open
          else scope = scope.where(status: params[:status])
          end
          scope = scope.where(kind: params[:kind]) if params[:kind].present?
          if params[:driver_id] == "none"
            scope = scope.where(driver_id: nil)
          elsif params[:driver_id].present?
            scope = scope.where(driver_id: params[:driver_id])
          end
          tasks, meta = paginate(scope)
          render json: { tasks: tasks.map { task_json(_1) }, meta:, drivers: User.drivers.order(:name).map { _1.slice(:id, :name) } }
        end

        def assign
          driver = User.drivers.find(params.require(:driver_id))
          previous = @task.driver&.name
          @task.assign_to!(driver, by: current_user)
          note!(previous ? "#{@task.kind.capitalize} task moved from #{previous} to #{driver.name}" : "#{@task.kind.capitalize} task assigned to #{driver.name}")
          render json: task_json(@task.reload)
        end

        def unassign
          previous = @task.driver&.name
          @task.unassign!(by: current_user)
          note!("#{@task.kind.capitalize} task removed from #{previous}")
          render json: task_json(@task.reload)
        end

        private

        def load_task = @task = DriverTask.find(params[:id])

        def note!(body) = @task.booking.notes.create!(user: current_user, kind: "internal", body:)

        def task_json(task)
          b = task.booking
          side = task.current_side
          task.as_json.except("proofs", "events").merge(
            reference: b.reference, booking_status: b.status,
            contact_name: b["#{side}_contact_name"], postcode: b["#{side}_postcode"], city: b["#{side}_city"],
            route: "#{b.collection_postcode} → #{b.delivery_postcode}", item: "#{b.quantity} × #{b.item_description}",
            proofs: task.proofs.to_h { [_1.kind, { person_name: _1.person_name, photo_count: _1.photos.size, signed: _1.signature_data.present? }] }
          )
        end
      end
    end
  end
end
