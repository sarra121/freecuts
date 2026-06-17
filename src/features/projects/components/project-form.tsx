import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Link } from '@tanstack/react-router'
import {
  createProjectFormSchema,
  type ProjectFormData,
  type ProjectTemplate,
  DEFAULT_PROJECT_VALUES,
  PROJECT_TEMPLATES,
} from '../utils/validation'
import { getProjectFpsOptions } from '../utils/project-fps'
import { ProjectTemplatePicker } from './project-template-picker'

interface ProjectFormProps {
  onSubmit: (data: ProjectFormData) => Promise<void> | void
  onCancel?: () => void
  defaultValues?: Partial<ProjectFormData>
  isEditing?: boolean
  isSubmitting?: boolean
  /** Retained for API compatibility; the compact form no longer renders its
   *  own page header (the dialog/route supplies the title). */
  hideHeader?: boolean
}

/**
 * Compact project create/edit form. Single column, sized to live inside a small
 * dialog: name, format preset (or custom dimensions), frame rate, description.
 */
export function ProjectForm({
  onSubmit,
  onCancel,
  defaultValues,
  isEditing = false,
  isSubmitting = false,
}: ProjectFormProps) {
  const { t } = useTranslation()
  const resolvedDefaultValues = useMemo(
    () => ({
      ...DEFAULT_PROJECT_VALUES,
      ...defaultValues,
    }),
    [defaultValues],
  )
  const validationSchema = useMemo(() => createProjectFormSchema((key) => t(key)), [t])

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    reset,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: resolvedDefaultValues,
    mode: 'onChange',
  })

  const matchTemplateId = (width: number, height: number) =>
    PROJECT_TEMPLATES.find((tpl) => tpl.width === width && tpl.height === height)?.id ?? 'custom'

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(() =>
    matchTemplateId(resolvedDefaultValues.width, resolvedDefaultValues.height),
  )

  useEffect(() => {
    reset(resolvedDefaultValues)
  }, [reset, resolvedDefaultValues])

  useEffect(() => {
    setSelectedTemplateId(
      matchTemplateId(resolvedDefaultValues.width, resolvedDefaultValues.height),
    )
  }, [resolvedDefaultValues.height, resolvedDefaultValues.width])

  const fps = watch('fps')
  const fpsOptions = useMemo(() => getProjectFpsOptions(fps), [fps])

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplateId(template.id)
    setValue('width', template.width, { shouldValidate: true })
    setValue('height', template.height, { shouldValidate: true })
    setValue('fps', template.fps, { shouldValidate: true })
  }

  const handleCustomSelect = () => {
    setSelectedTemplateId('custom')
  }

  const inputClass =
    'w-full px-3 py-2 bg-secondary border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Project Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
          {t('projects.form.projectName')} <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          className={inputClass}
          placeholder={t('projects.form.projectNamePlaceholder')}
        />
        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Format */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {t('projects.form.resolution')}
        </label>
        <ProjectTemplatePicker
          selectedTemplateId={selectedTemplateId === 'custom' ? undefined : selectedTemplateId}
          onSelectTemplate={handleSelectTemplate}
          onSelectCustom={handleCustomSelect}
          isCustomSelected={selectedTemplateId === 'custom'}
        />
        {selectedTemplateId === 'custom' && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor="width" className="block text-xs font-medium text-muted-foreground mb-1">
                {t('projects.form.widthPx')}
              </label>
              <input
                id="width"
                type="number"
                {...register('width', { valueAsNumber: true })}
                className={inputClass}
                placeholder="1920"
                min={320}
              />
              {errors.width && (
                <p className="mt-1 text-xs text-destructive">{errors.width.message}</p>
              )}
            </div>
            <span className="text-muted-foreground mt-4">×</span>
            <div className="flex-1">
              <label
                htmlFor="height"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                {t('projects.form.heightPx')}
              </label>
              <input
                id="height"
                type="number"
                {...register('height', { valueAsNumber: true })}
                className={inputClass}
                placeholder="1080"
                min={240}
              />
              {errors.height && (
                <p className="mt-1 text-xs text-destructive">{errors.height.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Frame Rate */}
      <div>
        <label htmlFor="fps" className="block text-sm font-medium text-foreground mb-1.5">
          {t('projects.form.frameRate')}
        </label>
        <Select
          value={fps.toString()}
          onValueChange={(value) => setValue('fps', Number(value), { shouldValidate: true })}
        >
          <SelectTrigger id="fps">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fpsOptions.map((preset) => (
              <SelectItem key={preset.value} value={preset.value.toString()}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.fps && <p className="mt-1 text-xs text-destructive">{errors.fps.message}</p>}
      </div>

      {/* Description (optional) */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1.5">
          {t('projects.form.description')}
        </label>
        <textarea
          id="description"
          rows={2}
          {...register('description')}
          className={`${inputClass} resize-none`}
          placeholder={t('projects.form.descriptionPlaceholder')}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        {onCancel ? (
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : (
          <Link to="/projects">
            <Button type="button" variant="outline" disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          </Link>
        )}
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting
            ? t('common.saving')
            : isEditing
              ? t('projects.form.updateProject')
              : t('projects.form.createProject')}
        </Button>
      </div>
    </form>
  )
}
