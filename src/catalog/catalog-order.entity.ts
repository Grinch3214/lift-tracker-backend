import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

// Один ряд на пользователя, не отдельная таблица сущностей — см. ARCHITECTURE.md#3
// ("Почему catalog_order — JSONB, а не нормализованная таблица").
@Entity('catalog_order')
export class CatalogOrder {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'catalog_order_user_id_fkey',
  })
  user: User;

  @Column({ type: 'jsonb', name: 'group_order', default: () => "'[]'" })
  groupOrder: string[];

  @Column({ type: 'jsonb', name: 'exercise_order', default: () => "'{}'" })
  exerciseOrder: Record<string, string[]>;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
