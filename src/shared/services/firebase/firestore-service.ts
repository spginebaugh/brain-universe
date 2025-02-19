import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  DocumentData,
  QueryConstraint,
  DocumentReference,
  CollectionReference,
} from 'firebase/firestore';
import { db } from './config';

export class FirestoreService<T extends DocumentData> {
  protected collectionPath: string;

  constructor(collectionPath: string) {
    this.collectionPath = collectionPath;
  }

  protected getCollection(): CollectionReference {
    return collection(db, this.collectionPath);
  }

  protected getDocRef(id: string): DocumentReference {
    return doc(db, this.collectionPath, id);
  }

  async create(id: string, data: T): Promise<void> {
    await setDoc(this.getDocRef(id), data);
  }

  async get(id: string): Promise<T | null> {
    const docSnap = await getDoc(this.getDocRef(id));
    return docSnap.exists() ? (docSnap.data() as T) : null;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await updateDoc(this.getDocRef(id), data as DocumentData);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(this.getDocRef(id));
  }

  async query(constraints: QueryConstraint[]): Promise<T[]> {
    const q = query(this.getCollection(), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as T);
  }

  async list(): Promise<T[]> {
    const querySnapshot = await getDocs(this.getCollection());
    return querySnapshot.docs.map(doc => doc.data() as T);
  }
} 