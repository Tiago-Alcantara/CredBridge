/**
 * SEP-6: Deposit and Withdrawal API
 *
 * Implements programmatic (non-interactive) deposit and withdrawal operations.
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md
 */

import type {
    Sep6Info,
    Sep6DepositRequest,
    Sep6DepositResponse,
    Sep6WithdrawRequest,
    Sep6WithdrawResponse,
    Sep6Transaction,
    TransactionStatus,
    SepError,
} from './types';
import { SepApiError } from './types';
import { createAuthHeaders } from './sep10';

export async function getInfo(
    transferServer: string,
    fetchFn: typeof fetch = fetch,
): Promise<Sep6Info> {
    const url = `${transferServer}/info`;
    const response = await fetchFn(url);
    if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as SepError;
        throw new SepApiError(
            errorBody.error || `Failed to get SEP-6 info: ${response.status}`,
            response.status,
            errorBody,
        );
    }
    return response.json() as any;
}

export async function deposit(
    transferServer: string,
    token: string,
    request: Sep6DepositRequest,
    fetchFn: typeof fetch = fetch,
): Promise<Sep6DepositResponse> {
    const url = new URL(`${transferServer}/deposit`);
    Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value));
    });
    const response = await fetchFn(url.toString(), { headers: createAuthHeaders(token) });
    if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as SepError;
        throw new SepApiError(
            errorBody.error || `Failed to initiate deposit: ${response.status}`,
            response.status,
            errorBody,
        );
    }
    return response.json() as any;
}

export async function withdraw(
    transferServer: string,
    token: string,
    request: Sep6WithdrawRequest,
    fetchFn: typeof fetch = fetch,
): Promise<Sep6WithdrawResponse> {
    const url = new URL(`${transferServer}/withdraw`);
    Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value));
    });
    const response = await fetchFn(url.toString(), { headers: createAuthHeaders(token) });
    if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as SepError;
        throw new SepApiError(
            errorBody.error || `Failed to initiate withdrawal: ${response.status}`,
            response.status,
            errorBody,
        );
    }
    return response.json() as any;
}

export async function getTransaction(
    transferServer: string,
    token: string,
    transactionId: string,
    fetchFn: typeof fetch = fetch,
): Promise<Sep6Transaction> {
    const url = new URL(`${transferServer}/transaction`);
    url.searchParams.set('id', transactionId);
    const response = await fetchFn(url.toString(), { headers: createAuthHeaders(token) });
    if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as SepError;
        throw new SepApiError(
            errorBody.error || `Failed to get transaction: ${response.status}`,
            response.status,
            errorBody,
        );
    }
    const data = await response.json() as any;
    return data.transaction;
}

export async function getTransactions(
    transferServer: string,
    token: string,
    params: {
        asset_code: string;
        account?: string;
        no_older_than?: string;
        limit?: number;
        kind?: 'deposit' | 'withdrawal';
        paging_id?: string;
        lang?: string;
    },
    fetchFn: typeof fetch = fetch,
): Promise<Sep6Transaction[]> {
    const url = new URL(`${transferServer}/transactions`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value));
    });
    const response = await fetchFn(url.toString(), { headers: createAuthHeaders(token) });
    if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as SepError;
        throw new SepApiError(
            errorBody.error || `Failed to get transactions: ${response.status}`,
            response.status,
            errorBody,
        );
    }
    const data = await response.json() as any;
    return data.transactions;
}

export function isComplete(status: TransactionStatus): boolean {
    return status === 'completed';
}

export function isPendingUser(status: TransactionStatus): boolean {
    return (
        status === 'pending_user_transfer_start' ||
        status === 'pending_user' ||
        status === 'pending_customer_info_update' ||
        status === 'pending_transaction_info_update'
    );
}

export function isPendingAnchor(status: TransactionStatus): boolean {
    return (
        status === 'pending_anchor' ||
        status === 'pending_stellar' ||
        status === 'pending_external' ||
        status === 'pending_trust' ||
        status === 'pending_user_transfer_complete'
    );
}

export function isFailed(status: TransactionStatus): boolean {
    return status === 'error' || status === 'expired' || status === 'no_market';
}

export function isRefunded(status: TransactionStatus): boolean {
    return status === 'refunded';
}

export function isInProgress(status: TransactionStatus): boolean {
    return !isComplete(status) && !isFailed(status) && !isRefunded(status);
}

export function getStatusDescription(status: TransactionStatus): string {
    const descriptions: Record<TransactionStatus, string> = {
        incomplete: 'Transaction not yet complete',
        pending_user_transfer_start: 'Waiting for you to initiate the transfer',
        pending_user_transfer_complete: 'Transfer received, processing',
        pending_external: 'Waiting for external system',
        pending_anchor: 'Anchor is processing',
        pending_stellar: 'Waiting for Stellar network confirmation',
        pending_trust: 'Waiting for trustline to be established',
        pending_user: 'Waiting for user action',
        pending_customer_info_update: 'Additional customer info required',
        pending_transaction_info_update: 'Additional transaction info required',
        pending_sender: 'Waiting for Stellar payment from sender',
        pending_receiver: 'Processing payment to receiver',
        completed: 'Transaction complete',
        refunded: 'Transaction refunded',
        expired: 'Transaction expired',
        error: 'Transaction failed',
        no_market: 'No market for this asset pair',
    };
    return descriptions[status] || status;
}
