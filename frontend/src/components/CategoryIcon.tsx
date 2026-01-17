import {
  Utensils,
  Car,
  Gamepad2,
  Heart,
  BookOpen,
  CreditCard,
  Home,
  ShoppingBag,
  HelpCircle,
  Smartphone,
  Plane,
  Tv,
  Dumbbell,
  Coffee,
  Gift,
  Briefcase,
  Wrench,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'

export const ICON_MAP: Record<string, LucideIcon> = {
  'utensils': Utensils,
  'car': Car,
  'gamepad-2': Gamepad2,
  'heart': Heart,
  'book-open': BookOpen,
  'credit-card': CreditCard,
  'home': Home,
  'shopping-bag': ShoppingBag,
  'help-circle': HelpCircle,
  'smartphone': Smartphone,
  'plane': Plane,
  'tv': Tv,
  'dumbbell': Dumbbell,
  'coffee': Coffee,
  'gift': Gift,
  'briefcase': Briefcase,
  'wrench': Wrench,
  'dollar-sign': DollarSign,
}

export const AVAILABLE_ICONS = Object.keys(ICON_MAP)

interface CategoryIconProps {
  icon: string | null
  className?: string
}

export function CategoryIcon({ icon, className = 'h-5 w-5' }: CategoryIconProps) {
  const Icon = ICON_MAP[icon || 'help-circle'] || HelpCircle
  return <Icon className={className} />
}

