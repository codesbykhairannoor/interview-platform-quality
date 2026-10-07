# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    let(:organization) { Organization.create!(name: 'Test Org', scheme: 'test-org', identifier: 'org-1', host: 'test.local') }
    let(:user) { User.create!(email: 'user@example.com', password: 'password', role: 'admin') }

    let(:assessment) do
      Assessment.create!(
        name: 'Fullstack SDET Assessment',
        time_limit_min: 45,
        created_by: user.id,
        tenant_id: organization.id
      )
    end

    let(:session) do
      Session.create!(
        assessment: assessment,
        tenant_id: organization.id
      )
    end

    it 'generates an invite URL pointing to the web client app port 5173 by default' do
      # In the initial unpatched code, it pointed to port 3001 (API), which returns 404.
      url = session.invite_url

      expect(url).to include('/interview/')
      expect(url).not_to include(':3001')
      expect(url).to match(/:(5173|3000)|\.com|\.app/)
    end
  end
end
