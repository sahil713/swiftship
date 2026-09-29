# Production image for Render (and any Docker host).
# syntax=docker/dockerfile:1
FROM ruby:3.3-slim AS base
WORKDIR /rails
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libpq5 libyaml-0-2 tzdata && \
    rm -rf /var/lib/apt/lists/*
ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT="development:test"

FROM base AS build
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libpq-dev libyaml-dev && \
    rm -rf /var/lib/apt/lists/*
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile
COPY . .
RUN bundle exec bootsnap precompile app/ lib/

FROM base
COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    mkdir -p db log storage tmp && chown -R rails:rails db log storage tmp
USER 1000:1000
ENTRYPOINT ["/rails/bin/docker-entrypoint"]
EXPOSE 3000
CMD ["./bin/rails", "server", "-b", "0.0.0.0"]
