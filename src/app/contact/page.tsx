'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, orderBy, query, serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
import type { WithId, ChatMessage, Conversation } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// This is the user-facing chat component
export default function ContactPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const conversationId = user?.uid;

  const messagesCollectionRef = useMemoFirebase(() => {
    if (!firestore || !conversationId) return null;
    return query(collection(firestore, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
  }, [firestore, conversationId]);

  const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(messagesCollectionRef);

  const conversationRef = useMemoFirebase(() => {
    if (!firestore || !conversationId) return null;
    return doc(firestore, 'conversations', conversationId);
  }, [firestore, conversationId]);
  const { data: conversation } = useDoc<Conversation>(conversationRef);

  useEffect(() => {
    // Redirect if not logged in
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    // Mark as read when page is opened
    if (firestore && user) {
        const conversationDocRef = doc(firestore, 'conversations', user.uid);
        setDoc(conversationDocRef, { isReadByUser: true }, { merge: true });
    }
  }, [user, isUserLoading, router, firestore]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !newMessage.trim()) return;

    setIsSending(true);
    const convId = user.uid;

    try {
        const conversationDocRef = doc(firestore, 'conversations', convId);
        const messagesRef = collection(conversationDocRef, 'messages');
        
        const messageData: Omit<ChatMessage, 'id'> = {
            senderId: user.uid,
            content: newMessage.trim(),
            createdAt: serverTimestamp(),
        };

        await addDoc(messagesRef, messageData);
        
        // Update conversation metadata
        const conversationData: Partial<Conversation> = {
            userId: user.uid,
            userEmail: user.email || 'N/A',
            userDisplayName: user.displayName || 'Utilisateur',
            lastMessageContent: newMessage.trim(),
            lastMessageAt: serverTimestamp(),
            isReadByAdmin: false, // Mark as unread for admin
            isReadByUser: true,
        };
        await setDoc(conversationDocRef, conversationData, { merge: true });

        setNewMessage('');
    } catch (error) {
        console.error("Error sending message:", error);
    } finally {
        setIsSending(false);
    }
  };

  if (isUserLoading) {
    return <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
  }
  
  if (!user) {
    return null; // or redirect, which useEffect handles
  }
  
  const lastMessage = messages?.[messages.length - 1];
  const isLastMessageFromUser = lastMessage?.senderId === user.uid;
  const hasAdminRead = conversation?.isReadByAdmin === true;

  return (
    <div className="max-w-2xl mx-auto">
        <Card className="h-[calc(100vh-10rem)] flex flex-col">
            <CardHeader>
                <CardTitle>Contacter l'administrateur</CardTitle>
                <CardDescription>Posez votre question ou laissez votre remarque ici. Nous vous répondrons dès que possible.</CardDescription>
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
                                    const isUserMessage = msg.senderId === user.uid;
                                    return (
                                        <div key={msg.id} className={cn("flex items-end gap-2", isUserMessage ? "justify-end" : "justify-start")}>
                                            {!isUserMessage && (
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>A</AvatarFallback>
                                                </Avatar>
                                            )}
                                            <div className={cn(
                                                "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                                                isUserMessage ? "bg-primary text-primary-foreground" : "bg-muted"
                                            )}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    )
                                })}
                                {isLastMessageFromUser && hasAdminRead && (
                                    <p className="text-right text-xs text-muted-foreground -mt-3 pr-2">Vu</p>
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
                            placeholder="Écrivez votre message..." 
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
