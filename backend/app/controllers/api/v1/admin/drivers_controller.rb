module Api
  module V1
    module Admin
      # Driver accounts: create, edit, reset credentials, deactivate/reactivate and remove.
      # Viewing is open to operations staff; changing accounts is admin-only.
      class DriversController < BaseController
        before_action :admin_only!, except: %i[index show]
        before_action :load_driver, only: %i[show update destroy]

        def index
          scope = User.where(role: "driver").order(:name)
          scope = scope.where(active: true) if params[:status] == "active"
          scope = scope.where(active: false) if params[:status] == "inactive"
          counts = DriverTask.where(driver_id: scope.select(:id)).group(:driver_id, :status).count
          render json: scope.map { |d| driver_json(d, counts) }
        end

        def show
          tasks = @driver.driver_tasks.includes(:proof, booking: :service).order(created_at: :desc).limit(100)
          render json: { driver: driver_json(@driver), tasks: tasks.map { task_summary(_1) } }
        end

        def create
          driver = User.create!(account_params.merge(role: "driver", active: true))
          render json: driver_json(driver), status: :created
        end

        # Edits details, resets the password (when given) and activates/deactivates the account.
        def update
          attrs = account_params
          attrs.delete(:password) if attrs[:password].blank?
          deactivating = attrs.key?(:active) && !ActiveModel::Type::Boolean.new.cast(attrs[:active]) && @driver.active
          unassigned = 0

          User.transaction do
            if deactivating
              holding = @driver.driver_tasks.where(status: "collected")
              if holding.exists?
                return render json: { error: "#{@driver.name} still has items from #{holding.count} collected job(s). Reassign those tasks before deactivating." },
                              status: :unprocessable_entity
              end
              @driver.driver_tasks.where(status: %w[assigned started]).find_each do |task|
                task.unassign!
                unassigned += 1
              end
            end
            @driver.update!(attrs)
          end
          render json: driver_json(@driver).merge(unassigned_tasks: unassigned)
        end

        # Permanently removes a driver who has never had a task. Drivers with history are deactivated instead.
        def destroy
          if @driver.driver_tasks.exists?
            return render json: { error: "#{@driver.name} has task history, which is kept for your records. Deactivate the account instead." },
                          status: :unprocessable_entity
          end
          @driver.destroy!
          head :no_content
        end

        private

        def load_driver = @driver = User.where(role: "driver").find(params[:id])

        def account_params = params.require(:driver).permit(:name, :phone, :email, :username, :password, :active)

        def driver_json(driver, counts = nil)
          counts ||= DriverTask.where(driver_id: driver.id).group(:driver_id, :status).count
          by_status = counts.select { |(id, _), _| id == driver.id }.transform_keys(&:last)
          driver.as_json.merge(
            open_tasks: by_status.slice("assigned", "started", "collected").values.sum,
            completed_tasks: by_status.slice("closed", "completed").values.sum
          )
        end

        def task_summary(task)
          b = task.booking
          task.as_json.except("proof").merge(
            reference: b.reference, booking_status: b.status, route: "#{b.collection_postcode} → #{b.delivery_postcode}",
            contact_name: task.collection? ? b.collection_contact_name : b.delivery_contact_name,
            item: "#{b.quantity} × #{b.item_description}", has_proof: task.proof.present?
          )
        end
      end
    end
  end
end
