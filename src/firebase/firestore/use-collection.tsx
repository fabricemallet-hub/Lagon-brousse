
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    collectionGroup?: string;
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries and waits for Auth synchronization.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // Determine path for security check
    let path: string = '';
    let isCollectionGroup = false;
    try {
      if (memoizedTargetRefOrQuery) {
        if (memoizedTargetRefOrQuery.type === 'collection') {
          path = (memoizedTargetRefOrQuery as CollectionReference).path;
        } else {
          // It's a query. Check for collectionGroup
          const internalQuery = memoizedTargetRefOrQuery as unknown as InternalQuery;
          if (internalQuery._query.collectionGroup) {
              path = internalQuery._query.collectionGroup;
              isCollectionGroup = true;
          } else {
              path = internalQuery._query.path.canonicalString() || 'query';
          }
        }
      }
    } catch (e) {
      path = (memoizedTargetRefOrQuery as any)?.path || '/';
    }

    // PUBLIC DATA BARRIER: Only wait for auth if the collection is potentially private.
    const isPublic = path && (
      path.includes('system_notifications') || 
      path.includes('meteo_caledonie') || 
      path.includes('promotions') ||
      path.includes('app_settings') ||
      path.includes('fish_species') ||
      path.includes('sound_library') ||
      path === 'promotions' || 
      isCollectionGroup && path === 'promotions'
    );
    
    const auth = getAuth();
    if (!isPublic && memoizedTargetRefOrQuery && !auth.currentUser) {
      return;
    }

    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        const errorPath = path || '/';
        console.error(`[DEBUG] useCollection - Error on path "${errorPath}":`, error.message);

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: errorPath,
        })

        setError(contextualError)
        setData(null)
        setIsLoading(false)

        // trigger global error propagation
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error };
}
