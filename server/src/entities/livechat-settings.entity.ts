import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'livechat_settings' })
export class LiveChatSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'text', nullable: true })
  company_name?: string;

  @Column({ type: 'text', nullable: true })
  sdr_name?: string;

  @Column({ type: 'text', nullable: true })
  system_prompt_override?: string;

  @Column({ type: 'text', nullable: true })
  test_system_prompt?: string;

  @Column({ type: 'text', nullable: true, default: 'flash' })
  ai_model_mode?: string;

  @Column({ type: 'text', nullable: true })
  elevenlabs_api_key?: string;

  @Column({ type: 'text', nullable: true })
  elevenlabs_voice_id?: string;

  @Column({ type: 'text', nullable: true })
  elevenlabs_model?: string;

  @Column({ type: 'numeric', default: 0.75 })
  elevenlabs_stability!: number;

  @Column({ type: 'numeric', default: 0.8 })
  elevenlabs_similarity_boost!: number;

  @Column({ type: 'numeric', default: 0.3 })
  elevenlabs_style!: number;

  @Column({ type: 'boolean', default: true })
  elevenlabs_speaker_boost!: boolean;

  @Column({ type: 'numeric', default: 1.0 })
  elevenlabs_speed!: number;

  @Column({ type: 'boolean', default: false })
  audio_response_enabled!: boolean;

  @Column({ type: 'text', nullable: true })
  whatsapp_access_token?: string;

  @Column({ type: 'text', nullable: true })
  whatsapp_phone_number_id?: string;

  @Column({ type: 'text', nullable: true })
  whatsapp_business_account_id?: string;

  @Column({ type: 'text', nullable: true })
  whatsapp_verify_token?: string;

  @Column({ type: 'boolean', default: true })
  auto_response_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  adaptive_response_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  message_breaking_enabled!: boolean;

  @Column({ type: 'integer', default: 1000 })
  response_delay_min!: number;

  @Column({ type: 'integer', default: 3000 })
  response_delay_max!: number;

  @Column({ type: 'text', default: 'America/Sao_Paulo' })
  timezone!: string;

  @Column({ type: 'time', default: '09:00:00' })
  business_hours_start!: string;

  @Column({ type: 'time', default: '18:00:00' })
  business_hours_end!: string;

  @Column({ type: 'integer', array: true, default: () => "'{1,2,3,4,5}'" })
  business_days!: number[];

  @Column({ type: 'boolean', default: false })
  async_booking_enabled!: boolean;

  @Column({ type: 'boolean', default: false })
  route_all_to_receiver_enabled!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  test_phone_numbers?: any;

  // ─── AI Settings ──────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  ai_copilot_enabled!: boolean;

  @Column({ type: 'text', nullable: true, default: 'gpt-4o-mini' })
  ai_copilot_model?: string;

  @Column({ type: 'text', nullable: true })
  ai_copilot_system_prompt?: string;

  @Column({ type: 'numeric', default: 0.2 })
  ai_copilot_temperature!: number;

  @Column({ type: 'boolean', default: true })
  ai_autosummary_enabled!: boolean;

  @Column({ type: 'text', nullable: true, default: 'short' })
  ai_summary_length?: string;

  @Column({ type: 'boolean', default: false })
  ai_behavior_verification_enabled!: boolean;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  ai_behavior_events?: any;

  @Column({ type: 'integer', default: 50 })
  ai_behavior_sample_size!: number;

  @Column({ type: 'text', nullable: true, default: 'openai' })
  ai_global_provider?: string;

  @Column({ type: 'text', nullable: true })
  ai_global_api_key?: string;

  @Column({ type: 'text', nullable: true, default: 'gpt-4o-mini' })
  ai_global_model?: string;

  @Column({ type: 'text', nullable: true })
  ai_global_base_url?: string;

  @Column({ type: 'boolean', default: false })
  ai_copilot_use_own!: boolean;

  @Column({ type: 'text', nullable: true, default: 'openai' })
  ai_copilot_provider?: string;

  @Column({ type: 'text', nullable: true })
  ai_copilot_api_key?: string;

  @Column({ type: 'text', nullable: true })
  ai_copilot_base_url?: string;

  @Column({ type: 'boolean', default: false })
  ai_summary_use_own!: boolean;

  @Column({ type: 'text', nullable: true, default: 'openai' })
  ai_summary_provider?: string;

  @Column({ type: 'text', nullable: true })
  ai_summary_api_key?: string;

  @Column({ type: 'text', nullable: true, default: 'gpt-4o-mini' })
  ai_summary_model?: string;

  @Column({ type: 'text', nullable: true })
  ai_summary_base_url?: string;

  @Column({ type: 'boolean', default: false })
  ai_behavior_use_own!: boolean;

  @Column({ type: 'text', nullable: true, default: 'openai' })
  ai_behavior_provider?: string;

  @Column({ type: 'text', nullable: true })
  ai_behavior_api_key?: string;

  @Column({ type: 'text', nullable: true, default: 'gpt-4o-mini' })
  ai_behavior_model?: string;

  @Column({ type: 'text', nullable: true })
  ai_behavior_base_url?: string;

  // ─── Main Agent AI Provider ────────────────────────
  @Column({ type: 'text', nullable: true, default: 'google' })
  ai_provider?: string;

  @Column({ type: 'text', nullable: true })
  ai_api_key?: string;

  @Column({ type: 'text', nullable: true, default: 'gemini-2.0-flash' })
  ai_model?: string;

  @Column({ type: 'text', nullable: true })
  ai_base_url?: string;

  @Column({ type: 'boolean', default: true })
  ai_scheduling_enabled!: boolean;

  @Column({ type: 'text', nullable: true })
  company_logo?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
