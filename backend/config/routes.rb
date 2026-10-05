Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      post "auth/register", to: "auth#register"
      post "auth/login", to: "auth#login"
      get "auth/me", to: "auth#me"
      patch "auth/me", to: "auth#update_me"

      get "services", to: "catalog#services"
      get "services/:slug", to: "catalog#service"
      get "areas", to: "catalog#areas"
      get "surcharges", to: "catalog#surcharges"
      get "site", to: "catalog#site"
      get "postcodes/check", to: "catalog#postcode"

      post "quotes", to: "quotes#create"
      get "track/:tracking_number", to: "tracking#show"
      post "enquiries", to: "enquiries#create"

      resources :addresses, only: %i[index create update destroy]
      resources :bookings, only: %i[index create show], param: :reference do
        member do
          post :pay
          post :change_request
        end
      end

      namespace :admin do
        get "dashboard", to: "dashboard#show"
        resources :bookings, only: %i[index show update], param: :reference do
          member do
            post :status
            post :confirm_price
            get :reprice
            post :assign_task
            post "tasks/:task_id/unassign", action: :unassign_task
            post :add_note
            post :refund
            post "change_requests/:change_request_id", action: :resolve_change_request
          end
        end
        resources :customers, only: %i[index show update]
        resources :staff, only: %i[index create update]
        resources :services, only: %i[index create update destroy]
        resources :delivery_areas, only: %i[index create update destroy]
        resources :surcharges, only: %i[index create update destroy]
        resources :postcode_rules, only: %i[index create update destroy]
        resources :drivers, only: %i[index show create update destroy]
        resources :tasks, only: :index do
          member do
            post :assign
            post :unassign
          end
        end
        resources :enquiries, only: %i[index update]
        resources :change_requests, only: :index
        get "settings", to: "settings#show"
        patch "settings", to: "settings#update"
      end

      namespace :driver do
        resources :tasks, only: %i[index show] do
          member do
            post :collect
            post :close
            post :start
            post :proof
            post :complete
            post :report_issue
          end
        end
      end
    end
  end
end
