import { templateService } from './TemplateService';
import { assetService } from './AssetService';
import { quotaService } from './QuotaService';
import { userContextManager } from '../security/UserContextManager';


export interface PreflightError {
    code: string;
    message: string;
    field?: string;
    action?: 'refresh' | 'edit_template' | 'check_quota' | 'check_connection';
}

export interface PreflightWarning {
    code: string;
    message: string;
}

export interface PreflightResult {
    isReady: boolean;
    errors: PreflightError[];
    warnings: PreflightWarning[];
}

export interface PreflightParams {
    templateId?: string;
    assetIds?: string[];
    contactCount: number;
    checkQuota?: boolean;
}

class PreflightService {
    private static instance: PreflightService;

    private constructor() { }

    public static getInstance(): PreflightService {
        if (!PreflightService.instance) {
            PreflightService.instance = new PreflightService();
        }
        return PreflightService.instance;
    }

    /**
     * Comprehensive validation before enabling send
     */
    async validateSendReadiness(params: PreflightParams): Promise<PreflightResult> {
        const errors: PreflightError[] = [];
        const warnings: PreflightWarning[] = [];

        // 1. Validate Context
        const userId = await userContextManager.getCurrentMasterUserId();
        if (!userId) {
            errors.push({
                code: 'AUTH_ERROR',
                message: 'User session invalid',
                action: 'refresh'
            });
            return { isReady: false, errors, warnings };
        }

        // 2. Validate Template
        if (!params.templateId) {
            errors.push({
                code: 'NO_TEMPLATE',
                message: 'No template selected',
                field: 'template'
            });
        } else {
            const template = await templateService.getTemplateById(params.templateId);

            if (!template) {
                errors.push({
                    code: 'TEMPLATE_NOT_FOUND',
                    message: 'Selected template not found locally',
                    field: 'template',
                    action: 'refresh'
                });
            } else {
                // Validate template content
                const hasContent = !!template.content;
                const hasVariants = template.variants && template.variants.length > 0;

                if (!hasContent && !hasVariants) {
                    errors.push({
                        code: 'TEMPLATE_EMPTY',
                        message: 'Template context is empty and has no variants',
                        field: 'template',
                        action: 'edit_template'
                    });
                }

                // Check sync status/metadata match (Simplified for now, can be expanded)
                // Ideally we check if local version matches cloud version hash if available
            }
        }

        // 3. Validate Assets
        if (params.assetIds && params.assetIds.length > 0) {
            for (const assetId of params.assetIds) {
                const asset = await assetService.getAssetById(assetId);
                if (!asset) {
                    errors.push({
                        code: 'ASSET_NOT_FOUND',
                        message: `Asset ${assetId} not found locally`,
                        field: 'assets',
                        action: 'refresh'
                    });
                }
                // Additional asset validation could go here (e.g. file existence on disk)
            }
        }

        // 4. Validate Quota (Optional - usually done at send time, but good to check early)
        if (params.checkQuota && params.contactCount > 0) {
            try {
                const hasQuota = await quotaService.hasSufficientQuota(userId, params.contactCount);
                if (!hasQuota) {
                    errors.push({
                        code: 'INSUFFICIENT_QUOTA',
                        message: `Insufficient quota for ${params.contactCount} messages`,
                        action: 'check_quota'
                    });
                }
            } catch (error) {
                // If offline or error checking quota, we might warn instead of block?
                // But per requirements, cloud first for quota.
                // If we can't check quota, we can't guarantee send.
                errors.push({
                    code: 'QUOTA_CHECK_FAILED',
                    message: 'Could not verify quota availability (Offline?)',
                    action: 'check_connection'
                });
            }
        }

        return {
            isReady: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Ensures essential metadata is synced from cloud before proceeding
     * @returns true if sync successful or already in sync
     */
    async ensureTemplateSync(templateId: string): Promise<boolean> {
        try {
            // Force sync logic for specific template could go here
            // For now, we rely on the service's sync mechanism
            // We could force a quick check with the server
            await templateService.forceSync();

            // Verify it exists after sync
            const template = await templateService.getTemplateById(templateId);
            return !!template;
        } catch (error) {
            console.error('Template sync ensure failed:', error);
            return false;
        }
    }

    /**
     * Pre-downloads assets to ensure they are ready for sending
     * @returns true if all assets ready
     */
    async ensureAssetsReady(assetIds: string[]): Promise<boolean> {
        if (!assetIds || assetIds.length === 0) return true;

        try {
            // Using the prefetch capability of AssetService
            // Note: We need to implement/expose retry logic in AssetService/WhatsAppManager later as per plan
            const result = await assetService.prefetchAssets(assetIds);
            return result.failed === 0;
        } catch (error) {
            console.error('Asset readiness ensure failed:', error);
            return false;
        }
    }
}

export const preflightService = PreflightService.getInstance();
