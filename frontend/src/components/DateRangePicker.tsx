import { useState, useEffect } from 'react'
import { DayPicker, DateRange } from 'react-day-picker'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { format, parse, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

type PeriodType = 'today' | 'week' | 'month' | 'custom'

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [customPeriodOpen, setCustomPeriodOpen] = useState(false)

  // Convert string dates to Date objects
  const from = startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined
  const to = endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : undefined

  // Detect current period type
  useEffect(() => {
    if (!from || !to) return

    const today = new Date()
    const todayStart = startOfDay(today)
    const todayEnd = endOfDay(today)
    
    if (
      format(from, 'yyyy-MM-dd') === format(todayStart, 'yyyy-MM-dd') &&
      format(to, 'yyyy-MM-dd') === format(todayEnd, 'yyyy-MM-dd')
    ) {
      setPeriodType('today')
    } else if (
      format(from, 'yyyy-MM-dd') === format(startOfWeek(today, { locale: ptBR }), 'yyyy-MM-dd') &&
      format(to, 'yyyy-MM-dd') === format(endOfWeek(today, { locale: ptBR }), 'yyyy-MM-dd')
    ) {
      setPeriodType('week')
    } else if (
      format(from, 'yyyy-MM-dd') === format(startOfMonth(today), 'yyyy-MM-dd') &&
      format(to, 'yyyy-MM-dd') === format(endOfMonth(today), 'yyyy-MM-dd')
    ) {
      setPeriodType('month')
    } else {
      setPeriodType('custom')
    }
  }, [from, to])

  const setToday = () => {
    const today = new Date()
    onStartDateChange(format(startOfDay(today), 'yyyy-MM-dd'))
    onEndDateChange(format(endOfDay(today), 'yyyy-MM-dd'))
    setPeriodType('today')
    setIsOpen(false)
  }

  const setThisWeek = () => {
    const today = new Date()
    onStartDateChange(format(startOfWeek(today, { locale: ptBR }), 'yyyy-MM-dd'))
    onEndDateChange(format(endOfWeek(today, { locale: ptBR }), 'yyyy-MM-dd'))
    setPeriodType('week')
    setIsOpen(false)
  }

  const setThisMonth = () => {
    const today = new Date()
    onStartDateChange(format(startOfMonth(today), 'yyyy-MM-dd'))
    onEndDateChange(format(endOfMonth(today), 'yyyy-MM-dd'))
    setPeriodType('month')
    setIsOpen(false)
  }

  const navigatePrevious = () => {
    if (!from) return
    
    switch (periodType) {
      case 'today': {
        const prev = subDays(from, 1)
        onStartDateChange(format(startOfDay(prev), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfDay(prev), 'yyyy-MM-dd'))
        break
      }
      case 'week': {
        const prev = subWeeks(from, 1)
        onStartDateChange(format(startOfWeek(prev, { locale: ptBR }), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfWeek(prev, { locale: ptBR }), 'yyyy-MM-dd'))
        break
      }
      case 'month': {
        const prev = subMonths(from, 1)
        onStartDateChange(format(startOfMonth(prev), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfMonth(prev), 'yyyy-MM-dd'))
        break
      }
      case 'custom': {
        if (!from || !to) return
        const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
        const newFrom = subDays(from, diff + 1)
        const newTo = subDays(to, diff + 1)
        onStartDateChange(format(newFrom, 'yyyy-MM-dd'))
        onEndDateChange(format(newTo, 'yyyy-MM-dd'))
        break
      }
    }
  }

  const navigateNext = () => {
    if (!from) return
    
    switch (periodType) {
      case 'today': {
        const next = addDays(from, 1)
        onStartDateChange(format(startOfDay(next), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfDay(next), 'yyyy-MM-dd'))
        break
      }
      case 'week': {
        const next = addWeeks(from, 1)
        onStartDateChange(format(startOfWeek(next, { locale: ptBR }), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfWeek(next, { locale: ptBR }), 'yyyy-MM-dd'))
        break
      }
      case 'month': {
        const next = addMonths(from, 1)
        onStartDateChange(format(startOfMonth(next), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfMonth(next), 'yyyy-MM-dd'))
        break
      }
      case 'custom': {
        if (!from || !to) return
        const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
        const newFrom = addDays(from, diff + 1)
        const newTo = addDays(to, diff + 1)
        onStartDateChange(format(newFrom, 'yyyy-MM-dd'))
        onEndDateChange(format(newTo, 'yyyy-MM-dd'))
        break
      }
    }
  }

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      onStartDateChange(format(range.from, 'yyyy-MM-dd'))
      
      if (!range?.to) {
        onEndDateChange(format(range.from, 'yyyy-MM-dd'))
      }
    }
    if (range?.to) {
      onEndDateChange(format(range.to, 'yyyy-MM-dd'))
    }
    
    if (range?.from && range?.to) {
      setPeriodType('custom')
      setTimeout(() => {
        setCustomPeriodOpen(false)
        setIsOpen(false)
      }, 200)
    }
  }

  const getDisplayText = () => {
    if (!from || !to) return 'Selecione o período'
    
    switch (periodType) {
      case 'today':
        return 'Hoje'
      case 'week':
        return 'Esta semana'
      case 'month':
        return 'Este mês'
      case 'custom':
        return `${format(from, 'dd/MM/yy')} - ${format(to, 'dd/MM/yy')}`
      default:
        return `${format(from, 'dd/MM/yy')} - ${format(to, 'dd/MM/yy')}`
    }
  }

  return (
    <div className="relative">
      {/* Main Period Display */}
      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <button
          type="button"
          onClick={navigatePrevious}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Período anterior"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>

        {/* Period Selector */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[200px]"
        >
          <span className="text-gray-700 font-medium">{getDisplayText()}</span>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Next Button */}
        <button
          type="button"
          onClick={navigateNext}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Próximo período"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setIsOpen(false)
              setCustomPeriodOpen(false)
            }}
          />
          
          {/* Menu */}
          <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[200px]">
            <button
              type="button"
              onClick={setToday}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700 border-b border-gray-100"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={setThisWeek}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700 border-b border-gray-100"
            >
              Esta semana
            </button>
            <button
              type="button"
              onClick={setThisMonth}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700 border-b border-gray-100"
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomPeriodOpen(true)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700 flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Escolher período
            </button>
          </div>
        </>
      )}

      {/* Custom Period Calendar */}
      {customPeriodOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setCustomPeriodOpen(false)}
          />
          
          {/* Calendar popup */}
          <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
            <DayPicker
              mode="range"
              selected={{ from, to }}
              onSelect={handleSelect}
              locale={ptBR}
              numberOfMonths={2}
              className="rdp-custom"
            />
          </div>
        </>
      )}

      <style>{`
        .rdp-custom {
          --rdp-cell-size: 40px;
          --rdp-accent-color: #3b82f6;
          --rdp-background-color: #dbeafe;
          font-family: inherit;
        }
        
        .rdp-custom .rdp-months {
          display: flex;
          gap: 2rem;
        }
        
        /* Mês e Ano */
        .rdp-custom .rdp-caption {
          display: flex;
          justify-content: center;
          padding: 0.75rem 0;
          font-weight: 700;
          color: #111827 !important;
          font-size: 1rem;
        }
        
        .rdp-custom .rdp-caption_label {
          color: #111827 !important;
          font-weight: 700;
        }
        
        /* Dias da semana (Dom, Seg, Ter...) */
        .rdp-custom .rdp-head_cell {
          color: #111827 !important;
          font-weight: 700;
          font-size: 0.75rem;
          text-transform: uppercase;
          padding: 0.5rem;
        }
        
        .rdp-custom .rdp-head {
          color: #111827 !important;
        }
        
        .rdp-custom .rdp-cell {
          padding: 0.25rem;
        }
        
        .rdp-custom .rdp-button {
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          width: 100%;
          height: 100%;
          background-color: transparent;
        }
        
        /* Dias normais - TEXTO ESCURO */
        .rdp-custom .rdp-day {
          color: #111827 !important;
          background-color: transparent !important;
          font-weight: 500;
        }
        
        /* Dias selecionados (início e fim do range) */
        .rdp-custom .rdp-day_selected,
        .rdp-custom .rdp-day_range_start,
        .rdp-custom .rdp-day_range_end {
          background-color: var(--rdp-accent-color) !important;
          color: white !important;
          font-weight: 700;
        }
        
        /* Dias no meio do range */
        .rdp-custom .rdp-day_range_middle {
          background-color: var(--rdp-background-color) !important;
          color: #1e40af !important;
          font-weight: 600;
        }
        
        /* Hover em dias não selecionados */
        .rdp-custom .rdp-day:not(.rdp-day_selected):not(.rdp-day_range_start):not(.rdp-day_range_end):not(.rdp-day_disabled):hover {
          background-color: #f3f4f6 !important;
          color: #111827 !important;
        }
        
        /* Dia atual (hoje) */
        .rdp-custom .rdp-day_today:not(.rdp-day_selected):not(.rdp-day_range_start):not(.rdp-day_range_end) {
          font-weight: bold;
          color: var(--rdp-accent-color) !important;
          text-decoration: underline;
          background-color: transparent !important;
        }
        
        /* Dias desabilitados */
        .rdp-custom .rdp-day_disabled {
          color: #d1d5db !important;
          opacity: 0.4;
          background-color: transparent !important;
        }
        
        /* Dias fora do mês atual */
        .rdp-custom .rdp-day_outside {
          color: #9ca3af !important;
          opacity: 0.4;
          background-color: transparent !important;
        }
        
        /* Botões de navegação */
        .rdp-custom .rdp-nav_button {
          width: 2rem;
          height: 2rem;
          border-radius: 0.375rem;
          color: #374151;
        }
        
        .rdp-custom .rdp-nav_button:hover {
          background-color: #f3f4f6;
        }
        
        .rdp-custom .rdp-nav_button svg {
          color: #374151;
        }
      `}</style>
    </div>
  )
}
