import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { PROJECT_TEMPLATES, getAspectRatio, type ProjectTemplate } from '../utils/validation'

interface ProjectTemplatePickerProps {
  onSelectTemplate: (template: ProjectTemplate) => void
  selectedTemplateId?: string
  onSelectCustom?: () => void
  isCustomSelected?: boolean
}

/**
 * Compact format picker for the create/edit project popup. A small 2-column
 * grid of professional landscape presets (+ optional Custom). Each chip shows a
 * tiny aspect-ratio silhouette, a label, and the resolution.
 */
export function ProjectTemplatePicker({
  onSelectTemplate,
  selectedTemplateId,
  onSelectCustom,
  isCustomSelected,
}: ProjectTemplatePickerProps) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-2">
      {PROJECT_TEMPLATES.map((template) => {
        const isSelected = selectedTemplateId === template.id
        const aspectRatio = getAspectRatio(template.width, template.height)
        return (
          <button
            key={template.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelectTemplate(template)}
            className={`group flex items-center gap-2.5 p-2.5 panel-bg border rounded-md text-left transition-all hover:border-primary/50 ${
              isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border'
            }`}
          >
            {/* Tiny aspect silhouette */}
            <div className="flex h-8 w-10 flex-shrink-0 items-center justify-center rounded bg-secondary/40">
              <div
                className={`rounded-[2px] border ${isSelected ? 'border-primary bg-primary/20' : 'border-primary/40 bg-primary/10'}`}
                style={{
                  aspectRatio: `${template.width} / ${template.height}`,
                  width: '70%',
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{template.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {template.width}×{template.height}
                <span className="mx-1">•</span>
                {aspectRatio}
              </p>
            </div>
          </button>
        )
      })}
      {onSelectCustom && (
        <button
          type="button"
          aria-pressed={isCustomSelected}
          onClick={onSelectCustom}
          className={`group flex items-center gap-2.5 p-2.5 panel-bg border rounded-md text-left transition-all hover:border-primary/50 ${
            isCustomSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border'
          }`}
        >
          <div className="flex h-8 w-10 flex-shrink-0 items-center justify-center rounded bg-secondary/40">
            <Plus
              className={`w-4 h-4 ${isCustomSelected ? 'text-primary' : 'text-muted-foreground/60'}`}
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {t('projects.templatePicker.custom')}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t('projects.templatePicker.enterDimensions')}
            </p>
          </div>
        </button>
      )}
    </div>
  )
}
