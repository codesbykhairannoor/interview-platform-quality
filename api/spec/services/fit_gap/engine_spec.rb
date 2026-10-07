# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  describe '#build_skill_comparisons' do
    let(:organization) { Organization.create!(name: 'Test Org', scheme: 'test-org', identifier: 'org-1', host: 'test.local') }
    let(:user) { User.create!(email: 'user@example.com', password: 'password', role: 'admin') }

    let(:assessment) do
      Assessment.create!(
        name: 'Senior Frontend Engineer',
        time_limit_min: 45,
        created_by: user.id,
        tenant_id: organization.id
      )
    end

    let(:session) do
      Session.create!(
        assessment: assessment,
        tenant_id: organization.id,
        status: 'ended'
      )
    end

    let(:portfolio) do
      Portfolio.create!(
        session: session,
        generation_status: 'complete'
      )
    end

    let!(:portfolio_skill) do
      portfolio.portfolio_skills.create!(
        skill_id: 'sk-eng-001',
        skill_label: 'React / Frontend Development',
        ai_level: 3,
        ai_confidence: 'high',
        evidence: ['Strong hooks usage'],
        competency_summary: 'Solid proficiency'
      )
    end

    let(:vacancy) do
      Vacancy.create!(
        role_title: 'Senior Frontend Engineer',
        created_by: user.id,
        tenant_id: organization.id
      )
    end

    let!(:vacancy_skill) do
      vacancy.vacancy_skills.create!(
        skill_id: 'sk-eng-001',
        skill_label: 'React / Frontend Development',
        expected_level: 3
      )
    end

    it 'returns comparison contract containing required_level matching frontend expectations' do
      engine = described_service.new(portfolio: portfolio, vacancy: vacancy)
      comparisons = engine.send(:build_skill_comparisons)

      expect(comparisons).not_to be_empty
      skill_comp = comparisons.first

      # Must contain required_level (or expected_level aliased)
      expect(skill_comp[:required_level]).to eq(3)
      expect(skill_comp[:candidate_level]).to eq(3)
      expect(skill_comp[:result]).to eq('match')
      expect(skill_comp[:is_override]).to be(false)
    end

    it 'flags is_override as true when an assessor override is present' do
      portfolio_skill.create_assessor_override!(
        ai_level: 3,
        override_level: 4,
        overridden_by: user.id,
        assessor_notes: 'Demonstrated L4 leadership in live code review'
      )

      engine = described_service.new(portfolio: portfolio, vacancy: vacancy)
      comparisons = engine.send(:build_skill_comparisons)

      skill_comp = comparisons.first
      expect(skill_comp[:candidate_level]).to eq(4)
      expect(skill_comp[:is_override]).to be(true)
      expect(skill_comp[:result]).to eq('exceed')
    end
  end
end
