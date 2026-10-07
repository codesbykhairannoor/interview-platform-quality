# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios Multi-Tenant Access', type: :request do
  describe 'Cross-tenant portfolio isolation' do
    let(:tenant_a) { Organization.create!(name: 'Tenant Alpha', scheme: 'tenant-a', identifier: 'alpha', host: 'alpha.local') }
    let(:tenant_b) { Organization.create!(name: 'Tenant Beta', scheme: 'tenant-b', identifier: 'beta', host: 'beta.local') }

    let(:user_a) { User.create!(email: 'assessor_a@example.com', password: 'password', role: 'admin') }
    let(:token_a) { JsonWebToken.encode({ user_id: user_a.id, role: 'admin', scheme: tenant_a.scheme }) }

    let(:assessment_b) do
      Assessment.create!(
        name: 'Assessment Beta',
        time_limit_min: 45,
        created_by: 999,
        tenant_id: tenant_b.id
      )
    end

    let(:session_b) do
      Session.create!(
        assessment: assessment_b,
        tenant_id: tenant_b.id,
        status: 'ended'
      )
    end

    let(:portfolio_b) do
      Portfolio.create!(
        session: session_b,
        generation_status: 'complete'
      )
    end

    it 'blocks assessor from Tenant A from accessing or exporting a portfolio belonging to Tenant B' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export",
          headers: { 'Authorization' => "Bearer #{token_a}" }

      # Should return 404 Not Found to prevent data leakage across tenant boundaries
      expect(response).to have_http_status(:not_found)
    end
  end
end
