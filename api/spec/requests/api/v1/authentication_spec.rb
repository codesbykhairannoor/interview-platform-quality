# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication API', type: :request do
  describe 'POST /api/v1/auth/login' do
    let(:password) { 'secretpassword123' }

    context 'when user has role "admin"' do
      let!(:admin_user) do
        User.create!(
          email: 'admin@example.com',
          password: password,
          password_confirmation: password,
          role: 'admin'
        )
      end

      it 'authenticates successfully and returns a token' do
        post '/api/v1/auth/login', params: { email: 'admin@example.com', password: password }

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['token']).to be_present
        expect(json['user']['role']).to eq('admin')
      end
    end

    context 'when user has role "assessor"' do
      let!(:assessor_user) do
        User.create!(
          email: 'assessor@example.com',
          password: password,
          password_confirmation: password,
          role: 'assessor'
        )
      end

      it 'authenticates successfully and allows assessor access' do
        post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: password }

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['token']).to be_present
        expect(json['user']['role']).to eq('assessor')
      end
    end
  end
end
