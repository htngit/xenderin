# Delay Settings Fix Implementation Plan

## Problem Summary
The delay settings configured in the UI (SendPage.tsx) are not being passed through to the service layer (MessageProcessor.ts), resulting in hardcoded delays instead of user-configured delays.

## Current Flow Analysis

### 1. UI Layer (SendPage.tsx)
- ✅ **Working**: UI correctly captures delay settings
- ✅ **Working**: Delay settings are stored in Dexie WAL job config
- ❌ **Issue**: Delay settings are NOT passed to IPC call

### 2. IPC Layer (ipcHandlers.ts)
- ❌ **Issue**: IPC handler doesn't receive delay settings
- ❌ **Issue**: JobData interface missing delay configuration

### 3. Service Layer (MessageProcessor.ts)
- ❌ **Issue**: Uses hardcoded delays (2-5 seconds)
- ❌ **Issue**: No access to user-configured delay settings

## Implementation Plan

### Phase 1: Update Data Structures

#### Task 1: Update JobData Interface
**File**: `src/main/MessageProcessor.ts`
**Changes**:
```typescript
export interface JobData {
    jobId: string;
    contacts: any[];
    template: any;
    assets?: string[];
    delayConfig: {
        mode: 'static' | 'dynamic';
        delayRange: number[]; // [min] for static, [min, max] for dynamic
    };
}
```

#### Task 2: Update IPC Handler Signature
**File**: `src/main/ipcHandlers.ts`
**Changes**:
```typescript
ipcMain.handle('whatsapp:process-job', async (_, { jobId, contacts, template, assets, delayConfig }) => {
    // ... existing code
    queueWorker.addToQueue({
        jobId,
        contacts,
        template,
        assets,
        delayConfig // Add this
    })
}
```

### Phase 2: Update UI to Pass Delay Settings

#### Task 3: Update SendPage IPC Call
**File**: `src/components/pages/SendPage.tsx`
**Changes** (around line 791):
```typescript
const result = await window.electron.whatsapp.processJob(
    jobId,
    targetContacts,
    selectedTemplateData,
    assetPaths,
    {
        mode: sendingMode,
        delayRange: sendingMode === 'static' ? [delayRange[0]] : delayRange
    } // Add delayConfig parameter
);
```

### Phase 3: Update MessageProcessor Logic

#### Task 4: Update MessageProcessor to Use Configurable Delays
**File**: `src/main/MessageProcessor.ts`
**Changes** (replace line 109):
```typescript
// Replace hardcoded delay with configurable delay
const delayMs = this.calculateDelayFromConfig(job.delayConfig);
await this.delay(delayMs);
```

Add new method:
```typescript
private calculateDelayFromConfig(delayConfig: JobData['delayConfig']): number {
    if (delayConfig.mode === 'static') {
        // Static mode: use the single delay value
        return delayConfig.delayRange[0] * 1000;
    } else {
        // Dynamic mode: random value between min and max
        const minDelay = delayConfig.delayRange[0] * 1000;
        const maxDelay = delayConfig.delayRange[1] * 1000;
        return minDelay + Math.random() * (maxDelay - minDelay);
    }
}
```

### Phase 4: Update QueueWorker

#### Task 5: Update QueueWorker to Handle Delay Config
**File**: `src/main/workers/QueueWorker.ts`
**Changes**: Ensure QueueWorker passes delayConfig through to MessageProcessor

## Testing Plan

### Unit Tests
1. **JobData Interface Validation**
   - Test that delayConfig is properly typed
   - Test validation of delay ranges

2. **Delay Calculation Logic**
   - Test static mode delay calculation
   - Test dynamic mode delay calculation
   - Test edge cases (min = max, etc.)

### Integration Tests
1. **IPC Communication**
   - Test that delayConfig is properly passed from renderer to main process
   - Test error handling for missing delayConfig

2. **MessageProcessor Integration**
   - Test that MessageProcessor receives and uses delayConfig correctly
   - Test fallback behavior if delayConfig is missing

### E2E Tests
1. **Full Flow Test**
   - Configure delay settings in UI
   - Start campaign
   - Verify delays are applied correctly
   - Verify WAL contains correct delay settings

## Validation Checklist

- [ ] JobData interface includes delayConfig
- [ ] IPC handler accepts and passes delayConfig
- [ ] SendPage passes delayConfig to IPC call
- [ ] MessageProcessor uses configurable delays
- [ ] QueueWorker handles delayConfig properly
- [ ] All TypeScript types are correct
- [ ] Error handling for missing/invalid delayConfig
- [ ] Backward compatibility maintained
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass

## Risk Assessment

### Low Risk
- Type changes are additive (new optional field)
- Backward compatibility maintained
- Existing functionality preserved

### Medium Risk
- Delay calculation logic changes
- IPC communication changes

### Mitigation
- Comprehensive testing
- Gradual rollout
- Feature flags if needed

## Implementation Order

1. Update interfaces and types
2. Update IPC handlers
3. Update UI calls
4. Update service layer logic
5. Add comprehensive tests
6. Manual validation

## Success Criteria

✅ User-configured delay settings are applied during message sending
✅ No hardcoded delays in production code
✅ All tests pass
✅ No regression in existing functionality
✅ Proper error handling for edge cases