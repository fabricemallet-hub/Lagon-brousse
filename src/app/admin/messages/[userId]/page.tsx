'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, orderBy, query, serverTimestamp, addDoc, setDoc, getDoc } from 'firebase/firestore';
import type { WithId, ChatMessage, Conversation, UserAccount } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';

export default function AdminMessagePage() {
  const params = useParams();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [targetUser, setTargetUser] = useState<UserAccount | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const isAdmin = useMemo(() => user?.email === 'f.mallet81@outlook.com', [user]);
  const conversationId = params.userId as string;

  const conversationRef = useMemoFirebase(() => {
    if (!firestore || !conversationId) return null;
    return doc(firestore, 'conversations', conversationId);
  }, [firestore, conversationId]);
  const { data: conversation } = useDoc<Conversation>(conversationRef);

  // Fetch target user's profile
  useEffect(() => {
    if (!firestore || !conversationId) return;
    const userDocRef = doc(firestore, 'users', conversationId);
    getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
            setTargetUser(docSnap.data() as UserAccount);
        }
    })
  }, [firestore, conversationId]);

  // Fetch messages
  const messagesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !conversationId) return null;
    return query(collection(firestore, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
  }, [firestore, conversationId]);

  const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(messagesCollectionRef);

  // Mark conversation as read by admin
  useEffect(() => {
    if (firestore && conversationId && isAdmin) {
        const conversationRef = doc(firestore, 'conversations', conversationId);
        setDoc(conversationRef, { isReadByAdmin: true }, { merge: true });
    }
  }, [firestore, conversationId, isAdmin, messages]);

  // Redirect if not admin
  useEffect(() => {
    if (!isUserLoading && !isAdmin) {
      router.push('/compte');
    }
  }, [isAdmin, isUserLoading, router]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !newMessage.trim() || !conversationId) return;

    setIsSending(true);

    try {
        const conversationRef = doc(firestore, 'conversations', conversationId);
        const messagesRef = collection(conversationRef, 'messages');
        
        const messageData: Omit<ChatMessage, 'id'> = {
            senderId: 'admin', // Admin is sending
            content: newMessage.trim(),
            createdAt: serverTimestamp(),
        };

        await addDoc(messagesRef, messageData);
        
        const conversationUpdate: Partial<Conversation> = {
            lastMessageContent: newMessage.trim(),
            lastMessageAt: serverTimestamp(),
            isReadByAdmin: true,
            isReadByUser: false, // Mark as unread for user
        };
        await setDoc(conversationRef, conversationUpdate, { merge: true });

        setNewMessage('');
    } catch (error) {
        console.error("Error sending message:", error);
    } finally {
        setIsSending(false);
    }
  };

  if (isUserLoading || !targetUser) {
    return <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
  }
  
  if (!isAdmin) {
    return null;
  }

  const lastMessage = messages?.[messages.length - 1];
  const isLastMessageFromAdmin = lastMessage?.senderId === 'admin';
  const hasUserRead = conversation?.isReadByUser === true;

  return (
    <div className="max-w-2xl mx-auto">
        <Button asChild variant="outline" size="sm" className="mb-4">
            <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Retour à la messagerie</Link>
        </Button>
        <Card className="h-[calc(100vh-13rem)] flex flex-col">
            <CardHeader>
                <CardTitle>Conversation avec {targetUser.displayName}</CardTitle>
                <CardDescription>{targetUser.email}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden flex flex-col p-0">
                <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {areMessagesLoading ? (
                            <>
                                <Skeleton className="h-10 w-3/4" />
                                <Skeleton className="h-10 w-3/4 ml-auto" />
                            </>
                        ) : messages && messages.length > 0 ? (
                           <>
                            {messages.map(msg => {
                                const isAdminMessage = msg.senderId === 'admin';
                                return (
                                    <div key={msg.id} className={cn("flex items-end gap-2", isAdminMessage ? "justify-end" : "justify-start")}>
                                        {!isAdminMessage && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>{targetUser.displayName[0]}</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn(
                                            "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                                            isAdminMessage ? "bg-primary text-primary-foreground" : "bg-muted"
                                        )}>
                                            {msg.content}
                                        </div>
                                    </div>
                                )
                            })}
                            {isLastMessageFromAdmin && hasUserRead && (
                                <p className="text-right text-xs text-muted-foreground -mt-3 pr-2">Vu par l'utilisateur</p>
                            )}
                            </>
                        ) : (
                            <p className="text-center text-muted-foreground">Aucun message pour le moment.</p>
                        )}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Input 
                            value={newMessage} 
                            onChange={e => setNewMessage(e.target.value)} 
                            placeholder="Répondre..." 
                            autoComplete="off"
                            disabled={isSending}
                        />
                        <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
